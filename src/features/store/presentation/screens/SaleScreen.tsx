import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PrimaryButton } from '../../../../ui/components/PrimaryButton';
import { Screen } from '../../../../ui/components/Screen';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { SaleReceipt, StoreCategory, StoreStockItem, TodaySalesSummary } from '../../domain/types';
import { parseSalePrice } from '../../domain/salePricing';
import { storeService } from '../../infrastructure/container';
import { formatEuros, grossProfitLabel, QuantityStepper, StoreCard, StoreMessage } from '../components/StoreComponents';

type CartLine = { key: number; group: StoreStockItem; units: number; agreed: boolean; priceCents: number };
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}
function saleRequestId(): string {
  return `sale-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function SaleScreen() {
  const { theme } = useTheme();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [stock, setStock] = useState<StoreStockItem[]>([]);
  const [category, setCategory] = useState<number | null>(null);
  const [selected, setSelected] = useState<StoreStockItem | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const nextKey = useRef(1);
  const [units, setUnits] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [price, setPrice] = useState('');
  const [summary, setSummary] = useState<TodaySalesSummary>({ totalCents: 0, unitsSold: 0 });
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const requestId = useRef(saleRequestId());
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void Promise.all([storeService.listCategories(), storeService.listStockItems(), storeService.getTodaySummary()])
      .then(([nextCategories, nextStock, today]) => {
        if (!active) return;
        setCategories(nextCategories);
        setStock(nextStock);
        setSummary(today);
      }).catch((cause) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const currentCart = cart.map((line) => ({ ...line, group: stock.find((item) => item.id === line.group.id) ?? line.group }));
  const totalUnits = currentCart.reduce((sum, line) => sum + line.units, 0);
  const totalCents = currentCart.reduce((sum, line) => sum + line.units * (line.agreed ? line.priceCents : line.group.priceCents), 0);
  const baseCents = currentCart.reduce((sum, line) => sum + line.units * line.group.priceCents, 0);
  const selectedGroup = stock.find((item) => item.id === selected?.id) ?? selected;
  const reserved = selectedGroup ? currentCart.filter((line) => line.group.id === selectedGroup.id && line.key !== editingKey)
    .reduce((sum, line) => sum + line.units, 0) : 0;
  const available = Math.max(0, (stock.find((item) => item.id === selected?.id)?.stockUnits ?? 0) - reserved);
  const stockChanged = currentCart.some((line) => {
    const group = stock.find((item) => item.id === line.group.id);
    const requested = currentCart.filter((item) => item.group.id === line.group.id).reduce((sum, item) => sum + item.units, 0);
    return !group || requested > group.stockUnits;
  });
  const unitPrice = agreed ? parseSalePrice(price) : selectedGroup?.priceCents ?? null;
  const validLine = units > 0 && units <= available && unitPrice !== null && Number.isSafeInteger(units * unitPrice)
    && Number.isSafeInteger(units * (selectedGroup?.priceCents ?? 0));
  const validCart = currentCart.length > 0 && Number.isSafeInteger(totalCents) && totalCents > 0
    && Number.isSafeInteger(baseCents) && Number.isSafeInteger(totalUnits);

  const openLine = (group: StoreStockItem, line?: CartLine) => {
    if (locked.current) return;
    setError(null);
    setSelected(group);
    setEditingKey(line?.key ?? null);
    setUnits(line?.units ?? 1);
    setAgreed(line?.agreed ?? false);
    setPrice(((line?.priceCents ?? group.priceCents) / 100).toFixed(2));
  };
  const updateCart = (next: CartLine[]) => {
    if (locked.current) return;
    requestId.current = saleRequestId();
    setLastReceipt(null);
    setCart(next);
  };
  const saveLine = () => {
    if (!selectedGroup || !validLine || unitPrice === null || locked.current) return;
    const line: CartLine = { key: editingKey ?? nextKey.current++, group: selectedGroup, units, agreed, priceCents: unitPrice };
    updateCart(editingKey === null ? [...currentCart, line] : currentCart.map((item) => item.key === editingKey ? line : item));
    setSelected(null);
    setCategory(null);
  };
  const completeSale = async () => {
    if (locked.current || !validCart || selected) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    let saved = false;
    try {
      const receipt = await storeService.completeSale({
        requestId: requestId.current,
        items: currentCart.map((line) => ({ priceGroupId: line.group.id, units: line.units,
          ...(line.agreed ? { unitPriceCents: line.priceCents } : {}) })),
      });
      saved = true;
      // Clear the charged cart before any refresh: a failed refresh must never offer to charge it again.
      setCart([]);
      requestId.current = saleRequestId();
      setLastReceipt(receipt);
      setCategory(null);
      setSummary((previous) => {
        const costTotalCents = previous.costTotalCents == null || receipt.costTotalCents == null ? null : previous.costTotalCents + receipt.costTotalCents;
        const nextTotal = previous.totalCents + receipt.totalCents;
        return { totalCents: nextTotal, unitsSold: previous.unitsSold + receipt.unitsSold, costTotalCents, profitCents: costTotalCents === null ? null : nextTotal - costTotalCents };
      });
      const [freshStock, today] = await Promise.all([storeService.listStockItems(), storeService.getTodaySummary()]);
      setStock(freshStock);
      setSummary(today);
    } catch (cause) {
      setError(saved ? 'Venta guardada. No se pudo actualizar la vista; volvé a entrar para refrescarla.' : errorMessage(cause));
      // The same reference survives a retry if the write succeeded but its response was interrupted.
      const freshStock = await storeService.listStockItems().catch(() => null);
      if (freshStock) setStock(freshStock);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const colors = { color: theme.colors.text };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, colors, { fontFamily: theme.typography.serifFamily }]}>Venta</Text>
        <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>Hoy · {formatEuros(summary.totalCents)} · {summary.unitsSold} unidades</Text>
        <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>Coste de lo vendido hoy · {summary.costTotalCents == null ? 'Pendiente' : formatEuros(summary.costTotalCents)}</Text>
        <Text style={[styles.subtitle, { color: summary.profitCents != null && summary.profitCents < 0 ? theme.colors.danger : theme.colors.mutedText }]}>{grossProfitLabel(summary.profitCents)}</Text>
      </View>
      {lastReceipt ? <View accessibilityLiveRegion="polite" style={[styles.successBanner, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md }]}>
        <Text style={[styles.successTitle, colors]}>Venta registrada</Text>
        <Text style={colors}>{lastReceipt.unitsSold} unidades · {formatEuros(lastReceipt.totalCents)}</Text>
        <Text style={colors}>Coste de compra · {lastReceipt.costTotalCents == null ? 'Pendiente' : formatEuros(lastReceipt.costTotalCents)}</Text>
        <Text style={{ color: lastReceipt.profitCents != null && lastReceipt.profitCents < 0 ? theme.colors.danger : theme.colors.text }}>{grossProfitLabel(lastReceipt.profitCents)}</Text>
      </View> : null}
      {error ? <StoreMessage message={error} error /> : null}
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {!loading && selectedGroup ? <View style={styles.quantityScreen}>
        <Text style={[styles.prompt, colors]}>{selectedGroup.categoryName}</Text>
        <Text style={[styles.selectedPrice, { color: theme.colors.primary }]}>Base · {formatEuros(selectedGroup.priceCents)} / unidad</Text>
        <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>{available} disponibles para esta línea</Text>
        <View style={styles.priceOptions} accessibilityRole="radiogroup" accessibilityLabel="Precio por unidad">
          {[false, true].map((option) => <Pressable key={String(option)} accessibilityRole="radio" aria-checked={agreed === option} accessibilityState={{ checked: agreed === option, disabled: busy }} disabled={busy}
            onPress={() => setAgreed(option)} style={[styles.priceOption, { borderColor: agreed === option ? theme.colors.primary : theme.colors.border, backgroundColor: agreed === option ? theme.colors.card : theme.colors.surface, borderRadius: theme.radius.md }]}>
            <Text style={colors}>{option ? 'Precio pactado' : 'Precio base'}</Text>
          </Pressable>)}
        </View>
        {agreed ? <View style={styles.list}>
          <Text style={colors}>Precio pactado por unidad (€)</Text>
          <TextInput accessibilityLabel="Precio pactado por unidad en euros" editable={!busy} keyboardType="decimal-pad" value={price} onChangeText={setPrice}
            placeholder="Ej. 3,00" placeholderTextColor={theme.colors.mutedText} style={[styles.priceInput, colors, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]} />
          {unitPrice === null ? <StoreMessage message="Escribí un precio mayor que cero, con hasta dos decimales." error /> : null}
        </View> : null}
        <QuantityStepper value={units} onChange={setUnits} max={available} label="unidad" />
        {units > available ? <StoreMessage message="Esta cantidad supera el stock disponible. Reducí unidades." error /> : null}
        <Text style={[styles.prompt, colors]}>Subtotal · {validLine && unitPrice ? formatEuros(units * unitPrice) : '—'}</Text>
        <PrimaryButton title={editingKey === null ? 'AGREGAR A LA VENTA' : 'GUARDAR CAMBIOS'} onPress={saveLine} disabled={!validLine || busy} />
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.textButton}><Text style={{ color: theme.colors.primary }}>Cancelar</Text></Pressable>
      </View> : null}
      {!loading && !selected ? <>
        {currentCart.length > 0 ? <View style={styles.list}>
          <Text style={[styles.prompt, colors]}>Tu venta · {totalUnits} unidades</Text>
          {stockChanged ? <StoreMessage message="El stock cambió. Revisá las cantidades; se comprobarán otra vez al confirmar." error /> : null}
          {currentCart.map((line, index) => <StoreCard key={line.key}>
            <Text style={[styles.cardTitle, colors]}>{line.group.categoryName} · {line.units} {line.units === 1 ? 'unidad' : 'unidades'}</Text>
            <Text style={[styles.cardHint, { color: theme.colors.mutedText }]}>Base {formatEuros(line.group.priceCents)} / unidad</Text>
            <Text style={colors}>{line.agreed ? 'Pactado' : 'Precio base'} · {formatEuros(line.agreed ? line.priceCents : line.group.priceCents)} / unidad</Text>
            <View style={styles.groupRow}>
              <Text style={[styles.cardTitle, colors]}>{formatEuros(line.units * (line.agreed ? line.priceCents : line.group.priceCents))}</Text>
              <View style={styles.lineActions}>
                <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Editar línea ${index + 1}, ${line.group.categoryName}`} onPress={() => openLine(line.group, line)} style={styles.textButton}><Text style={{ color: theme.colors.primary }}>Editar</Text></Pressable>
                <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Quitar línea ${index + 1}, ${line.group.categoryName}`} onPress={() => updateCart(currentCart.filter((item) => item.key !== line.key))} style={styles.textButton}><Text style={{ color: theme.colors.danger }}>Quitar</Text></Pressable>
              </View>
            </View>
          </StoreCard>)}
          <View style={[styles.successBanner, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md }]}>
            <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>A precio base · {formatEuros(baseCents)}</Text>
            <Text style={[styles.selectedPrice, colors]}>Total a cobrar · {formatEuros(totalCents)}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>Los precios pactados solo se aplican a esta venta. El beneficio bruto real se muestra al registrarla.</Text>
          </View>
          <PrimaryButton title={`CONFIRMAR VENTA · ${formatEuros(totalCents)}`} busy={busy} disabled={!validCart || busy} onPress={() => void completeSale()} />
        </View> : <StoreMessage message="Agregá las joyas. Podés respetar su precio base o pactar otro por unidad." />}
        <View style={styles.list}>
          <Text style={[styles.prompt, colors]}>{currentCart.length ? 'Agregar otra joya' : 'Elegí una categoría'}</Text>
          {category !== null ? <Pressable disabled={busy} accessibilityRole="button" onPress={() => setCategory(null)} style={styles.textButton}><Text style={{ color: theme.colors.primary }}>‹ Todas las categorías</Text></Pressable> : null}
          {category === null ? categories.map((item) => <StoreCard key={item.id} disabled={busy} onPress={() => setCategory(item.id)} accessibilityLabel={`Elegir ${item.name}`}>
            <Text style={[styles.cardTitle, colors]}>{item.name}</Text>
          </StoreCard>) : stock.filter((item) => item.categoryId === category).map((group) => {
            const remaining = Math.max(0, group.stockUnits - currentCart.filter((line) => line.group.id === group.id).reduce((sum, line) => sum + line.units, 0));
            return <StoreCard key={group.id} disabled={remaining === 0 || busy} onPress={() => openLine(group)} accessibilityLabel={`${group.categoryName}, base ${formatEuros(group.priceCents)}, ${remaining} disponibles`}>
              <Text style={[styles.cardTitle, colors]}>{group.categoryName} · {formatEuros(group.priceCents)}</Text>
              <Text style={[styles.cardHint, { color: theme.colors.mutedText }]}>{remaining ? `${remaining} disponibles` : 'Sin stock disponible'}</Text>
            </StoreCard>;
          })}
          {categories.length === 0 ? <StoreMessage message="Agregá categorías desde Tienda." /> : null}
          {category !== null && !stock.some((item) => item.categoryId === category) ? <StoreMessage message="Esta categoría no tiene grupos. Configuralos desde Tienda." /> : null}
        </View>
      </> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  priceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  priceOption: { minHeight: 48, padding: 14, borderWidth: 1, flexGrow: 1, alignItems: 'center' },
  priceInput: { minHeight: 52, borderWidth: 1, paddingHorizontal: 14, fontSize: 22 },
  textButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  lineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    gap: 20,
    paddingBottom: 28,
  },
  header: {
    gap: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
  },
  subtitle: {
    fontSize: 15,
  },
  prompt: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
  },
  list: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  cardHint: {
    fontSize: 14,
    marginTop: 3,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevron: {
    fontSize: 30,
    lineHeight: 32,
  },
  loading: {
    paddingVertical: 32,
  },
  successBanner: {
    padding: 14,
    gap: 3,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  quantityScreen: {
    gap: 16,
  },
  selectedPrice: {
    fontSize: 26,
    fontWeight: '700',
  },
  remaining: {
    minHeight: 88,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  remainingLabel: {
    fontSize: 15,
  },
  remainingValue: {
    fontSize: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
