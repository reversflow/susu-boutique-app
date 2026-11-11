import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '../../../../core/utils/currency';
import { LedgerRow } from '../../../../ui/components/LedgerRow';
import { useTheme } from '../../../../core/theme/ThemeProvider';

interface MonthOverviewMetrics {
  totalSold: number;
  totalInvested: number;
  totalAdditionalExpenses: number;
  grossProfit: number;
  netProfit: number;
  totalDataphoneSales: number;
}

export interface MonthSummaryInput {
  month: Date;
  overview: MonthOverviewMetrics;
}

interface MonthSummaryCardProps {
  monthly: MonthSummaryInput;
  isCurrentMonth?: boolean;
  badge?: string | null;
  onPressDataphone?: () => void;
  onPressMonth?: () => void;
}

export function formatMonthName(date: Date): string {
  return date.toLocaleDateString('es-ES', { month: 'long' });
}

export function MonthSummaryCard({
  monthly,
  isCurrentMonth = false,
  badge = null,
  onPressDataphone,
  onPressMonth,
}: MonthSummaryCardProps) {
  const { theme } = useTheme();
  const { month, overview } = monthly;
  const monthName = formatMonthName(month);
  const monthTitle = (
    <Text
      style={[
        styles.monthName,
        {
          color: isCurrentMonth ? theme.colors.primary : theme.colors.text,
          fontFamily: theme.typography.serifFamily,
        },
      ]}
    >
      {monthName}
    </Text>
  );

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        isCurrentMonth
          ? { borderColor: theme.colors.primary }
          : null,
      ]}
    >
      <View style={styles.header}>
        {onPressMonth ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir mes de ${monthName} en el calendario`}
            accessibilityHint="Muestra este mes en el calendario"
            onPress={onPressMonth}
            style={({ pressed }) => [styles.headerMonthButton, pressed ? styles.pressed : null]}
          >
            {monthTitle}
            <Text accessibilityElementsHidden style={[styles.monthChevron, { color: theme.colors.mutedText }]}>›</Text>
          </Pressable>
        ) : monthTitle}
        {badge ? <Text style={[styles.badge, { color: theme.colors.primary }]}>{badge}</Text> : null}
      </View>

      <View style={styles.rows}>
        <LedgerRow label="Ventas" value={formatCurrency(overview.totalSold)} valueColor={theme.colors.sales} />
        <LedgerRow label="Beneficio bruto" value={formatCurrency(overview.grossProfit)} valueColor={overview.grossProfit < 0 ? theme.colors.danger : overview.grossProfit > 0 ? theme.colors.success : theme.colors.text} />
        <LedgerRow label="Destinado a inversión" value={formatCurrency(overview.totalInvested)} valueColor={theme.colors.investment} />
        <LedgerRow label="Otros gastos" value={formatCurrency(overview.totalAdditionalExpenses)} valueColor={theme.colors.danger} />
        <LedgerRow
          label={overview.netProfit < 0 ? 'Pérdida neta' : 'Beneficio neto'}
          value={formatCurrency(overview.netProfit)}
          valueColor={overview.netProfit < 0 ? theme.colors.danger : overview.netProfit > 0 ? theme.colors.success : theme.colors.text}
        />
        <LedgerRow
          label="Ventas datafono"
          value={formatCurrency(overview.totalDataphoneSales)}
          valueColor={theme.colors.sales}
          onPress={onPressDataphone}
          accessibilityLabel={`Ventas datafono de ${monthName}, ${formatCurrency(overview.totalDataphoneSales)}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  rows: {
    gap: 4,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthName: {
    fontSize: 22,
    textTransform: 'capitalize',
  },
  headerMonthButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthChevron: {
    fontSize: 22,
  },
  badge: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.65,
  },
});
