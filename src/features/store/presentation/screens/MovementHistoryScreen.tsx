import { useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../ui/components/Screen';
import { FadeIn } from '../../../../ui/components/FadeIn';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { staggerDelay } from '../../../../ui/motion';
import { groupMovementsByDay, summarizeMovements } from '../../domain/movementHistory';
import type { StockMovement } from '../../domain/types';
import { storeService } from '../../infrastructure/container';
import {
  movementDayLabel,
  movementTimeLabel,
  MovementFilter,
  MovementRow,
  MOVEMENT_FILTERS,
} from '../components/MovementHistory';
import { formatEuros, StoreMessage } from '../components/StoreComponents';

function Tile({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <View style={styles.tileHeading}>
        <Feather name={icon} size={13} color={theme.colors.primary} />
        <Text style={[styles.tileLabel, { color: theme.colors.mutedText }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.tileValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.tileHint, { color: theme.colors.mutedText }]} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.colors.card : theme.colors.surface,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radius.md,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? theme.colors.primary : theme.colors.mutedText }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MovementHistoryScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [filter, setFilter] = useState<MovementFilter>('todo');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    storeService.listRecentMovements(100)
      .then((next) => {
        if (mounted) setMovements(next);
      })
      .catch((cause) => {
        if (mounted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el historial.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = useMemo(
    () => movements.filter((movement) =>
      (filter === 'todo' || movement.movementType === filter)
      && (category == null || movement.categoryName === category)),
    [category, filter, movements],
  );
  const totals = useMemo(() => summarizeMovements(visible), [visible]);
  const groups = useMemo(() => groupMovementsByDay(visible), [visible]);
  const profitTone = (totals.profitCents ?? 0) < 0 ? theme.colors.danger : theme.colors.success;

  return (
    <Screen contentContainerStyle={styles.content}>
      {error ? <StoreMessage message={error} error /> : null}

      {loading ? (
        <Text style={[styles.status, { color: theme.colors.mutedText }]}>Cargando movimientos…</Text>
      ) : (
        <>
          <FadeIn>
            <View style={[styles.tileGrid, width >= 900 ? styles.tileGridDesktop : null]}>
              <Tile
                icon="shopping-bag"
                label="Ventas cobradas"
                value={formatEuros(totals.salesCents)}
                hint={`${totals.salesCount} ${totals.salesCount === 1 ? 'venta' : 'ventas'}`}
                color={theme.colors.sales}
              />
              <Tile
                icon="truck"
                label="Coste de compras"
                value={totals.purchaseCents == null ? 'Pendiente' : formatEuros(totals.purchaseCents)}
                hint={totals.purchasePendingCount > 0
                  ? `${totals.purchasePendingCount} ${totals.purchasePendingCount === 1 ? 'entrada sin coste' : 'entradas sin coste'}`
                  : `${totals.purchaseCount} ${totals.purchaseCount === 1 ? 'entrada' : 'entradas'}`}
                color={theme.colors.investment}
              />
              <Tile
                icon="trending-up"
                label="Beneficio bruto"
                value={totals.profitCents == null ? 'Pendiente' : formatEuros(totals.profitCents)}
                hint={totals.pendingCount > 0 ? `${totals.pendingCount} ventas con datos incompletos` : 'sobre las ventas cobradas'}
                color={totals.profitCents == null ? theme.colors.mutedText : profitTone}
              />
              <Tile
                icon="package"
                label="Unidades vendidas"
                value={String(totals.unitsSold)}
                hint="según los movimientos"
                color={theme.colors.text}
              />
            </View>
          </FadeIn>

          <FadeIn delay={staggerDelay(1)}>
            <View style={styles.toolbar}>
              <Text style={[styles.toolbarLabel, { color: theme.colors.mutedText }]}>Tipo</Text>
              {MOVEMENT_FILTERS.map((option) => (
                <FilterChip
                  key={option.key}
                  label={option.label}
                  active={filter === option.key}
                  onPress={() => setFilter(option.key)}
                />
              ))}
              {category ? (
                <FilterChip label={`${category} ✕`} active onPress={() => setCategory(null)} />
              ) : null}
            </View>
          </FadeIn>

          <FadeIn delay={staggerDelay(2)}>
            <View style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
              <View style={styles.panelHeading}>
                <View style={[styles.panelIcon, { backgroundColor: theme.colors.card, borderRadius: theme.radius.sm }]}>
                  <Feather name="repeat" size={14} color={theme.colors.primary} />
                </View>
                <View style={styles.panelHeadingText}>
                  <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Ventas y compras</Text>
                  <Text style={[styles.panelSubtitle, { color: theme.colors.mutedText }]} numberOfLines={1}>
                    {category ?? 'Toda la tienda'} · {visible.length} {visible.length === 1 ? 'movimiento' : 'movimientos'}
                  </Text>
                </View>
              </View>

              {groups.length === 0 ? (
                <Text style={[styles.empty, { color: theme.colors.mutedText }]}>
                  {movements.length === 0
                    ? 'Todavía no hay movimientos de stock.'
                    : 'No hay movimientos con estos filtros.'}
                </Text>
              ) : (
                groups.map((group) => (
                  <View key={group.day}>
                    <View style={[styles.dayHeader, { borderBottomColor: theme.colors.border }]}>
                      <Text style={[styles.dayTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {movementDayLabel(group.day)}
                      </Text>
                      <Text style={[styles.dayCount, { color: theme.colors.mutedText }]} numberOfLines={1}>
                        {group.movements.length} {group.movements.length === 1 ? 'movimiento' : 'movimientos'}
                      </Text>
                    </View>
                    {group.movements.map((movement) => (
                      <MovementRow
                        key={movement.id}
                        movement={movement}
                        timeLabel={movementTimeLabel(movement.createdAt)}
                      />
                    ))}
                  </View>
                ))
              )}
            </View>
          </FadeIn>

          <Text style={[styles.note, { color: theme.colors.mutedText }]}>
            Mostrando los últimos 100 movimientos guardados.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    gap: 12,
    paddingBottom: 32,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileGridDesktop: { flexWrap: 'nowrap' },
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 0, borderWidth: 1, padding: 12, gap: 3 },
  tileHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { flex: 1, fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  tileHint: { fontSize: 12 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  toolbarLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 2 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 200 },
  chipText: { fontSize: 12, fontWeight: '600' },
  panel: { borderWidth: 1, padding: 14, gap: 4 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 4 },
  panelIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  panelHeadingText: { flex: 1, minWidth: 0, gap: 1 },
  panelTitle: { fontSize: 15, fontWeight: '700' },
  panelSubtitle: { fontSize: 12 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    marginTop: 6,
  },
  dayTitle: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  dayCount: { fontSize: 11.5 },
  empty: { fontSize: 13, lineHeight: 18, paddingVertical: 6 },
  note: { fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  status: { fontSize: 15, paddingVertical: 16 },
});
