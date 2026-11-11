import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../../../ui/components/Screen';
import { FadeIn } from '../../../../ui/components/FadeIn';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { addMonths, daysInMonthCount, startOfMonth } from '../../../../core/utils/date';
import { computeDailyProfit } from '../../../daily-records/domain/calculators';
import { DailyRecord } from '../../../daily-records/domain/types';
import { useMonthlyOverview } from '../../../daily-records/presentation/hooks/useMonthlyOverview';
import { StoreDashboardSummary, StoreStockItem, StockMovement } from '../../domain/types';
import { calculateLogisticsAnalytics, LogisticsDayInput } from '../../domain/logisticsAnalytics';
import { storeService } from '../../infrastructure/container';
import { LogisticsDashboard } from '../components/LogisticsDashboard';
import { RecentMovementsPanel } from '../components/MovementHistory';
import { StoreMessage } from '../components/StoreComponents';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo cargar la logística.';
}

function toDayInput(record: DailyRecord): LogisticsDayInput {
  const { grossProfit, netProfit } = computeDailyProfit(record);
  return {
    date: record.date,
    totalSold: record.totalSold,
    additionalExpenses: record.additionalExpenses,
    grossProfit,
    netProfit,
    dataphoneSales: record.dataphoneSales ?? 0,
  };
}

export function LogisticsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stockItems, setStockItems] = useState<StoreStockItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<StoreDashboardSummary | null>(null);
  const [categorySalesSummary, setCategorySalesSummary] = useState<{
    categoryId: number;
    summary: StoreDashboardSummary;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const monthStart = useMemo(() => addMonths(startOfMonth(new Date()), monthOffset), [monthOffset]);
  const monthly = useMonthlyOverview(monthStart);
  const monthLabel = monthStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const categories = useMemo(() => {
    const byId = new Map<number, string>();
    stockItems.forEach((item) => byId.set(item.categoryId, item.categoryName));
    return [...byId].map(([id, name]) => ({ id, name }));
  }, [stockItems]);
  const visibleStock = useMemo(
    () => (selectedCategoryId == null ? stockItems : stockItems.filter((item) => item.categoryId === selectedCategoryId)),
    [selectedCategoryId, stockItems],
  );
  const visibleMovements = useMemo(() => {
    if (selectedCategoryId == null) return movements;
    const name = categories.find((category) => category.id === selectedCategoryId)?.name;
    return movements.filter((movement) => movement.categoryName === name);
  }, [categories, movements, selectedCategoryId]);
  const scopedSalesSummary = selectedCategoryId == null
    ? salesSummary
    : categorySalesSummary?.categoryId === selectedCategoryId
      ? categorySalesSummary.summary
      : null;
  const analytics = useMemo(
    () =>
      calculateLogisticsAnalytics({
        stock: visibleStock,
        sales: scopedSalesSummary ?? { unitsSold: 0, revenueCents: 0, soldCostCents: null },
        month: monthly.overview
          ? { ...monthly.overview, daysInMonth: daysInMonthCount(monthStart) }
          : null,
        days: monthly.records.map(toDayInput),
      }),
    [monthStart, monthly.overview, monthly.records, scopedSalesSummary, visibleStock],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMovements, nextStock, nextSales] = await Promise.all([
        storeService.listRecentMovements(25),
        storeService.listStockItems(),
        storeService.getDashboardSummary(),
      ]);
      setMovements(nextMovements);
      setStockItems(nextStock);
      setSalesSummary(nextSales);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useFocusEffect(useCallback(() => {
    let mounted = true;

    void Promise.all([
      storeService.listStockItems(),
      storeService.getDashboardSummary(),
      storeService.listRecentMovements(25),
      selectedCategoryId == null ? Promise.resolve(null) : storeService.getDashboardSummary(selectedCategoryId),
    ]).then(([nextStock, nextSales, nextMovements, nextCategorySales]) => {
      if (!mounted) return;
      setStockItems(nextStock);
      setSalesSummary(nextSales);
      setMovements(nextMovements);
      setCategorySalesSummary(
        selectedCategoryId == null || nextCategorySales == null
          ? null
          : { categoryId: selectedCategoryId, summary: nextCategorySales },
      );
    }).catch((cause) => {
      if (mounted) setError(errorMessage(cause));
    });

    void monthly.refresh();

    return () => {
      mounted = false;
    };
  }, [monthly.refresh, selectedCategoryId]));

  return (
    <Screen keyboardAware contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.serifFamily }]}>Logística</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>Inventario, contabilidad y movimientos de stock</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gestionar proveedores"
          onPress={() => router.push('/suppliers' as never)}
          style={({ pressed }) => [
            styles.linkButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather name="truck" size={14} color={theme.colors.primary} />
          <Text style={[styles.link, { color: theme.colors.primary }]}>Proveedores</Text>
        </Pressable>
      </View>

      {!loading && scopedSalesSummary ? (
        <LogisticsDashboard
          analytics={analytics}
          monthLabel={monthLabel}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={(categoryId) => {
            if (categoryId === selectedCategoryId) return;
            setCategorySalesSummary(null);
            setSelectedCategoryId(categoryId);
          }}
          onPreviousMonth={() => setMonthOffset((offset) => offset - 1)}
          onNextMonth={() => setMonthOffset((offset) => Math.min(0, offset + 1))}
          isCurrentMonth={monthOffset >= 0}
        />
      ) : null}

      {error ? <StoreMessage message={error} error /> : null}

      {!loading ? (
        <FadeIn>
          <RecentMovementsPanel
            movements={visibleMovements}
            scopeName={categories.find((category) => category.id === selectedCategoryId)?.name ?? null}
            onOpenHistory={() => {
              const scoped = categories.find((category) => category.id === selectedCategoryId)?.name ?? null;
              router.push({
                pathname: '/logistics/history',
                params: scoped ? { category: scoped } : {},
              } as never);
            }}
          />
        </FadeIn>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    gap: 22,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  grow: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 34,
  },
  subtitle: {
    fontSize: 15,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
});
