import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../../../ui/components/Screen';
import { PrimaryButton } from '../../../../ui/components/PrimaryButton';
import { FadeIn } from '../../../../ui/components/FadeIn';
import { staggerDelay } from '../../../../ui/motion';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { createFocusRefreshGuard } from '../../../../core/utils/focusRefreshGuard';
import { formatCurrency } from '../../../../core/utils/currency';
import { formatSpanishShortDate, monthKey, startOfMonth, toIsoDate } from '../../../../core/utils/date';
import { useMonthlyOverview } from '../hooks/useMonthlyOverview';
import { useMostRecentDailyRecord } from '../hooks/useMostRecentDailyRecord';
import { useInvestmentBalance } from '../../investment/presentation/hooks/useInvestmentBalance';
import { KpiCard } from '../components/KpiCard';
import { UpcomingHolidaysCard } from '../components/UpcomingHolidaysCard';
import { LastDaySummaryCard } from '../components/LastDaySummaryCard';

export function HomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [today, setToday] = useState(() => new Date());
  const todayIso = toIsoDate(today);
  const overviewMonthKey = monthKey(today);
  const overviewMonth = useMemo(
    () => startOfMonth(new Date(`${overviewMonthKey}-01T00:00:00`)),
    [overviewMonthKey],
  );
  const { loading, error, overview, refresh } = useMonthlyOverview(overviewMonth);
  const lastDaySummary = useMostRecentDailyRecord(todayIso);
  const investmentBalance = useInvestmentBalance();
  const shouldRefreshOnFocus = useRef(createFocusRefreshGuard());

  useFocusEffect(
    useCallback(() => {
      const focusedAt = new Date();
      setToday(focusedAt);
      void lastDaySummary.refresh(toIsoDate(focusedAt));
      void investmentBalance.refresh();

      if (shouldRefreshOnFocus.current()) {
        void refresh();
      }
    }, [refresh, investmentBalance.refresh, lastDaySummary.refresh]),
  );

  if (loading) {
    return (
      <Screen topInset bottomInset={false}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.supportingText, { color: theme.colors.mutedText }]}>Cargando resumen...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !overview) {
    const technicalDetail = error?.technicalMessage;

    return (
      <Screen topInset bottomInset={false}>
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
            {error?.userMessage ?? 'No se pudo cargar el inicio.'}
          </Text>
          {__DEV__ && technicalDetail ? (
            <Text style={[styles.supportingText, { color: theme.colors.mutedText }]}>{technicalDetail}</Text>
          ) : null}
          <PrimaryButton title="Reintentar" onPress={() => void refresh()} />
        </View>
      </Screen>
    );
  }

  const businessName = Constants.expoConfig?.name ?? 'Modas Nicolas';
  const monthName = overviewMonth.toLocaleDateString('es-ES', { month: 'long' });
  const todayLabel = formatSpanishShortDate(today);
  const netProfitLabel = overview.netProfit < 0 ? 'Pérdida neta' : 'Beneficio neto';
  const formattedAvailable = investmentBalance.error
    ? 'No disponible'
    : investmentBalance.loading
      ? 'Cargando…'
      : formatCurrency(investmentBalance.available);
  const availableValueColor = investmentBalance.error || investmentBalance.loading
    ? theme.colors.mutedText
    : investmentBalance.available < 0
      ? theme.colors.danger
      : theme.colors.investment;
  const registerDayToday = () => {
    const actionDate = new Date();
    setToday(actionDate);
    router.push(`/day/${toIsoDate(actionDate)}` as never);
  };
  const addInvestmentToday = () => {
    const actionDate = new Date();
    setToday(actionDate);
    router.push(`/investment/purchase?date=${toIsoDate(actionDate)}` as never);
  };

  return (
    <Screen topInset bottomInset={false}>
      <FadeIn delay={staggerDelay(0)}>
        <View style={styles.brandHeader}>
          <View style={styles.brand}>
            <Text
              style={[
                styles.businessName,
                { color: theme.colors.text, fontFamily: theme.typography.serifFamily },
              ]}
            >
              {businessName}
            </Text>
          </View>
          <Text style={[styles.today, { color: theme.colors.mutedText }]}>{todayLabel}</Text>
        </View>
      </FadeIn>

      <FadeIn delay={staggerDelay(1)}>
        <View style={styles.monthHeading}>
          <Text
            style={[
              styles.monthName,
              { color: theme.colors.text, fontFamily: theme.typography.serifFamily },
            ]}
          >
            {`${monthName} ${overviewMonth.getFullYear()}`}
          </Text>
        </View>
        <Text style={[styles.monthCaption, { color: theme.colors.mutedText }]}>Resumen del mes</Text>
      </FadeIn>

      <FadeIn delay={staggerDelay(2)}>
        <View
          style={[
            styles.netCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.cardLabel, { color: theme.colors.mutedText }]}>{netProfitLabel}</Text>
          <Text
            accessibilityLabel={`${netProfitLabel}, ${formatCurrency(overview.netProfit)}`}
            style={[
              styles.netValue,
              {
                color:
                  overview.netProfit < 0
                    ? theme.colors.danger
                    : overview.netProfit > 0
                      ? theme.colors.success
                      : theme.colors.text,
              },
            ]}
          >
            {`${overview.netProfit < 0 ? '−' : overview.netProfit > 0 ? '+' : ''}${formatCurrency(Math.abs(overview.netProfit))}`}
          </Text>
        </View>
      </FadeIn>

      <FadeIn delay={staggerDelay(3)}>
        <View style={styles.metricGrid}>
          <KpiCard label="Ventas" value={formatCurrency(overview.totalSold)} valueColor={theme.colors.sales} />
          <KpiCard
            label="Beneficio bruto"
            value={formatCurrency(overview.grossProfit)}
            valueColor={overview.grossProfit < 0 ? theme.colors.danger : overview.grossProfit > 0 ? theme.colors.success : theme.colors.text}
          />
          <KpiCard
            label="Gastos"
            value={formatCurrency(overview.totalAdditionalExpenses)}
            valueColor={theme.colors.danger}
          />
          <KpiCard
            label="Inversión asignada"
            value={formatCurrency(overview.totalInvested)}
            valueColor={theme.colors.investment}
          />
        </View>
      </FadeIn>

      <FadeIn delay={staggerDelay(4)} style={styles.availableSection}>
        <View style={[styles.availableCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.investment }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Disponible para invertir, ${formattedAvailable}. Ver saldo y movimientos.`}
            accessibilityHint="Abre el saldo disponible y el historial de movimientos"
            onPress={() => router.push('/investment/balance' as never)}
            style={({ pressed }) => [styles.availableSummary, pressed ? styles.pressed : null]}
          >
            <Text style={[styles.availableLabel, { color: theme.colors.mutedText }]}>Disponible para invertir</Text>
            <Text style={[styles.availableValue, { color: availableValueColor }]}>{formattedAvailable}</Text>
            <Text style={[styles.availableLink, { color: theme.colors.primary }]}>Ver saldo y movimientos →</Text>
          </Pressable>
          {investmentBalance.error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
              {investmentBalance.error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Agregar inversión hoy, ${todayLabel}`}
            onPress={addInvestmentToday}
            style={({ pressed }) => [styles.investmentAction, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }, pressed ? styles.pressed : null]}
          >
            <Text style={[styles.investmentActionLabel, { color: theme.colors.onPrimary }]}>Agregar inversión hoy</Text>
          </Pressable>
        </View>
      </FadeIn>

      {overview.trackedDays === 0 ? (
        <Text style={[styles.emptyHint, { color: theme.colors.mutedText }]}>Todavía no hay registros este mes.</Text>
      ) : null}

      <FadeIn delay={staggerDelay(5)}>
        <LastDaySummaryCard loading={lastDaySummary.loading} error={lastDaySummary.error} result={lastDaySummary.result} />
      </FadeIn>

      <FadeIn delay={staggerDelay(6)}>
        <PrimaryButton
          title="Registrar el día de hoy"
          accessibilityLabel={`Registrar el día de hoy, ${todayLabel}`}
          onPress={registerDayToday}
        />
      </FadeIn>

      <FadeIn delay={staggerDelay(7)}>
        <UpcomingHolidaysCard />
      </FadeIn>

    </Screen>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    flex: 1,
    minWidth: 0,
  },
  businessName: {
    fontSize: 22,
  },
  supportingText: {
    fontSize: 13,
    lineHeight: 19,
  },
  today: {
    maxWidth: '48%',
    fontSize: 13,
    textAlign: 'right',
  },
  monthHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  monthName: {
    fontSize: 32,
    lineHeight: 41,
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  monthCaption: {
    marginTop: -4,
    fontSize: 13,
    lineHeight: 19,
  },
  netCard: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cardLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  netValue: {
    fontSize: 34,
    lineHeight: 43,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availableSection: {
    gap: 8,
  },
  availableCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 14,
    gap: 10,
  },
  availableSummary: {
    gap: 2,
  },
  availableLabel: {
    fontSize: 15,
    lineHeight: 22,
  },
  availableValue: {
    fontSize: 36,
    lineHeight: 45,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  availableLink: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  investmentAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  investmentActionLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyHint: {
    paddingVertical: 8,
    fontSize: 14,
  },
  center: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  error: {
    fontSize: 15,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
});
