import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../../../../ui/components/Screen';
import { LedgerRow } from '../../../../../ui/components/LedgerRow';
import { useTheme } from '../../../../../core/theme/ThemeProvider';
import { formatCurrency } from '../../../../../core/utils/currency';
import { investmentBalanceService } from '../../../infrastructure/container';
import {
  InvestmentHistoryCursor,
  InvestmentHistoryItem,
  InvestmentType,
} from '../../domain/types';
import { addMonths, monthKey, parseYearMonth } from '../../../../../core/utils/date';
import { useInvestmentBalance } from '../hooks/useInvestmentBalance';
import { InvestmentBalanceCard } from '../components/InvestmentBalanceCard';
import { createInvestmentHistoryRequestGate } from './investmentHistoryRequestGate';

function formatHistoryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

const HISTORY_PAGE_SIZE = 25;

export function InvestmentBalanceScreen() {
  const { theme } = useTheme();
  const balance = useInvestmentBalance();
  const [history, setHistory] = useState<InvestmentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<InvestmentHistoryCursor | null>(null);
  const [typeFilter, setTypeFilter] = useState<InvestmentType | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [monthDraft, setMonthDraft] = useState(() => monthKey(new Date()));
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const historyGate = useRef(createInvestmentHistoryRequestGate()).current;
  const focusCount = useRef(0);

  const refreshHistory = useCallback(async () => {
    const request = historyGate.beginRefresh();
    setHistoryLoading(true);
    setHistoryError(null);
    setLoadMoreError(false);
    setLoadingMore(false);
    setHasMore(false);
    setNextCursor(null);
    setHistory([]);
    try {
      const page = await investmentBalanceService.listHistoryPage({
        limit: HISTORY_PAGE_SIZE,
        type: typeFilter,
        month: monthFilter,
      });
      if (historyGate.isCurrent(request)) {
        setHistory(page.items);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      }
    } catch {
      if (historyGate.isCurrent(request)) setHistoryError('No se pudo cargar el historial.');
    } finally {
      if (historyGate.isCurrent(request)) setHistoryLoading(false);
    }
  }, [historyGate, monthFilter, typeFilter]);

  const loadMoreHistory = useCallback(async () => {
    if (!hasMore || !nextCursor || historyLoading) return;
    const token = historyGate.tryBeginLoadMore();
    if (!token) return;
    const request = token.requestRevision;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await investmentBalanceService.listHistoryPage({
        limit: HISTORY_PAGE_SIZE,
        cursor: nextCursor,
        type: typeFilter,
        month: monthFilter,
      });
      if (historyGate.isCurrent(request)) {
        setHistory((items) => [...items, ...page.items]);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      }
    } catch {
      if (historyGate.isCurrent(request)) setLoadMoreError(true);
    } finally {
      historyGate.finishLoadMore(token);
      if (historyGate.isCurrent(request)) setLoadingMore(false);
    }
  }, [hasMore, historyGate, historyLoading, monthFilter, nextCursor, typeFilter]);

  useFocusEffect(
    useCallback(() => {
      if (focusCount.current > 0) void balance.refresh();
      focusCount.current += 1;
      void refreshHistory();
      return () => {
        historyGate.invalidate();
      };
    }, [balance.refresh, refreshHistory]),
  );

  const addAdjustment = useCallback(async (input: { date: string; amount: number; note: string }) => {
    const saved = await balance.addAdjustment(input);
    if (saved) await refreshHistory();
    return saved;
  }, [balance.addAdjustment, refreshHistory]);

  const addPurchase = useCallback(async (input: {
    date: string;
    amount: number;
    note: string;
    supplierId?: number | null;
  }) => {
    const saved = await balance.addPurchase(input);
    if (saved) await refreshHistory();
    return saved;
  }, [balance.addPurchase, refreshHistory]);

  const retryAll = () => {
    void balance.refresh();
    void refreshHistory();
  };

  const shiftMonthDraft = (delta: number) => {
    const current = parseYearMonth(monthDraft) ?? new Date();
    setMonthDraft(monthKey(addMonths(current, delta)));
  };

  const monthDraftDate = parseYearMonth(monthDraft) ?? new Date();
  const monthDraftLabel = monthDraftDate.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Screen scroll={false} contentContainerStyle={styles.screenContent}>
      <FlatList
        style={styles.historyList}
        contentContainerStyle={styles.historyContent}
        data={history}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const amount = item.type === 'compra' ? -Math.abs(item.amount) : item.amount;
          const label = item.type === 'compra'
            ? item.supplierName ? `Inversión · ${item.supplierName}` : 'Inversión a proveedor'
            : amount < 0 ? 'Retiro manual' : 'Ajuste manual';
          return (
            <LedgerRow
              label={label}
              hint={[formatHistoryDate(item.date), item.note].filter(Boolean).join(' · ')}
              value={formatCurrency(amount)}
              valueColor={amount < 0 ? theme.colors.danger : undefined}
            />
          );
        }}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <InvestmentBalanceCard
              available={balance.available}
              adjustmentsTotal={balance.adjustmentsTotal}
              investedTotal={balance.investedTotal}
              purchasesTotal={balance.purchasesTotal}
              loading={balance.loading}
              adding={balance.adding}
              error={balance.error}
              actionError={balance.addError}
              onAddAdjustment={addAdjustment}
              onAddPurchase={addPurchase}
              onRefresh={retryAll}
            />
            <View style={styles.historyHeader}>
              <Text style={[styles.heading, { color: theme.colors.text, fontFamily: theme.typography.serifFamily }]}>Movimientos</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeFilters}>
              {([
                { value: null, label: 'Todos' },
                { value: 'compra' as const, label: 'Inversiones' },
                { value: 'ajuste' as const, label: 'Ajustes' },
              ]).map((option) => {
                const selected = typeFilter === option.value;
                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setTypeFilter(option.value)}
                    style={[styles.filterChip, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primary : theme.colors.surface, borderRadius: theme.radius.md }]}
                  >
                    <Text style={[styles.filterLabel, { color: selected ? theme.colors.onPrimary : theme.colors.text }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={monthFilter ? `Filtrar por ${monthFilter}` : 'Filtrar por mes'}
              onPress={() => {
                setMonthDraft(monthFilter ?? monthKey(new Date()));
                setMonthPickerVisible(true);
              }}
              style={[styles.monthFilter, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
            >
              <Text style={[styles.monthFilterLabel, { color: theme.colors.text }]}>
                {monthFilter ? monthDraftLabel : 'Todos los meses'}
              </Text>
              <Text style={[styles.monthFilterChevron, { color: theme.colors.primary }]}>▾</Text>
            </Pressable>
            {historyLoading && history.length === 0 ? (
              <View style={styles.state}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={[styles.stateText, { color: theme.colors.mutedText }]}>Cargando movimientos...</Text>
              </View>
            ) : null}
            {historyError ? (
              <View style={styles.state}>
                <Text accessibilityRole="alert" style={[styles.stateText, { color: theme.colors.danger }]}>{historyError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void refreshHistory()} style={styles.retryButton}>
                  <Text style={[styles.retryLabel, { color: theme.colors.primary }]}>Reintentar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={!historyLoading && !historyError ? (
          <Text style={[styles.stateText, { color: theme.colors.mutedText }]}>No hay movimientos para estos filtros.</Text>
        ) : null}
        ListFooterComponent={(
          <View style={styles.listFooter}>
            {loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
            {loadMoreError ? (
              <Pressable accessibilityRole="button" onPress={() => void loadMoreHistory()} style={styles.retryButton}>
                <Text style={[styles.retryLabel, { color: theme.colors.primary }]}>No se pudieron cargar más movimientos. Reintentar</Text>
              </Pressable>
            ) : null}
            {hasMore && !loadingMore && !loadMoreError ? (
              <Pressable accessibilityRole="button" onPress={() => void loadMoreHistory()} style={[styles.loadMoreButton, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
                <Text style={[styles.loadMoreLabel, { color: theme.colors.primary }]}>Cargar más</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />

      <Modal visible={monthPickerVisible} transparent animationType="fade" onRequestClose={() => setMonthPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMonthPickerVisible(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.monthPicker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
            <Text style={[styles.monthPickerTitle, { color: theme.colors.text }]}>Filtrar por mes</Text>
            <View style={styles.monthStepper}>
              <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => shiftMonthDraft(-1)} style={styles.monthStepButton}>
                <Text style={[styles.monthStepText, { color: theme.colors.primary }]}>‹</Text>
              </Pressable>
              <Text style={[styles.monthDraftLabel, { color: theme.colors.text }]}>{monthDraftLabel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => shiftMonthDraft(1)} style={styles.monthStepButton}>
                <Text style={[styles.monthStepText, { color: theme.colors.primary }]}>›</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={() => { setMonthFilter(null); setMonthPickerVisible(false); }} style={[styles.monthPickerAction, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
              <Text style={[styles.monthPickerActionText, { color: theme.colors.text }]}>Todos los meses</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setMonthFilter(monthDraft); setMonthPickerVisible(false); }} style={[styles.monthPickerAction, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
              <Text style={[styles.monthPickerActionText, { color: theme.colors.onPrimary }]}>Aplicar mes</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: 0,
  },
  historyList: {
    flex: 1,
  },
  historyContent: {
    gap: 8,
    paddingBottom: 12,
  },
  listHeader: {
    gap: 8,
  },
  historyHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  heading: {
    fontSize: 22,
  },
  typeFilters: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    minHeight: 40,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthFilter: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthFilterLabel: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  monthFilterChevron: {
    fontSize: 20,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  state: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  listFooter: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadMoreButton: {
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  loadMoreLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  monthPicker: {
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  monthPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  monthStepper: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthStepButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthStepText: {
    fontSize: 32,
    fontWeight: '600',
  },
  monthDraftLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  monthPickerAction: {
    minHeight: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  monthPickerActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
