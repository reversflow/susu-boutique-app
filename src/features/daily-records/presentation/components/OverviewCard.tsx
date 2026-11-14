import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../../../../core/utils/currency';
import { MonthlyOverview } from '../../domain/types';
import { useTheme } from '../../../../core/theme/ThemeProvider';

interface Props {
  overview: MonthlyOverview;
}

export function OverviewCard({ overview }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.md,
          borderColor: theme.colors.border,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Resumen mensual</Text>
      <View style={styles.grid}>
        <Metric label="Vendido" value={formatCurrency(overview.totalSold)} />
        <Metric label="Invertido" value={formatCurrency(overview.totalInvested)} />
        <Metric label="Gastos" value={formatCurrency(overview.totalAdditionalExpenses)} />
        <Metric label="Bruto" value={formatCurrency(overview.grossProfit)} />
        <Metric label="Neto" value={formatCurrency(overview.netProfit)} highlight={overview.netProfit >= 0} danger={overview.netProfit < 0} />
        <Metric label="Salario (30%)" value={formatCurrency(overview.estimatedSalary)} />
      </View>
      <Text style={[styles.meta, { color: theme.colors.mutedText }]}>Días con registro: {overview.trackedDays}</Text>
    </View>
  );
}

function Metric({ label, value, highlight = false, danger = false }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  const { theme } = useTheme();

  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.colors.mutedText }]}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          { color: theme.colors.text },
          highlight ? { color: theme.colors.success } : null,
          danger ? { color: theme.colors.danger } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  metric: {
    width: '50%',
    gap: 2,
  },
  metricLabel: {
    fontSize: 13,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
  },
});
