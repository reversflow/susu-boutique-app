import { ReactNode, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { FadeIn } from '../../../../ui/components/FadeIn';
import { staggerDelay } from '../../../../ui/motion';
import type { LogisticsAnalytics } from '../../domain/logisticsAnalytics';
import { formatEuros } from './StoreComponents';

type Tone = 'default' | 'success' | 'danger' | 'muted' | 'sales' | 'investment';

type InsightKey =
  | 'bestDay'
  | 'lossDays'
  | 'dataphoneShare'
  | 'averageDailySales'
  | 'averageDailyExpenses'
  | 'projectedNet';

type Insight = {
  key: InsightKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: (analytics: LogisticsAnalytics) => string;
  hint: (analytics: LogisticsAnalytics) => string;
  tone?: (analytics: LogisticsAnalytics) => Tone;
};

function money(value: number | null): string {
  return value == null ? 'Pendiente' : formatEuros(value);
}

function percent(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

function dayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

/** Every extra metric the team can pin on the dashboard. Add an entry here and it shows up as a toggle. */
const INSIGHTS: Insight[] = [
  {
    key: 'bestDay',
    label: 'Mejor día',
    icon: 'award',
    value: (analytics) => (analytics.insights.bestDay ? money(analytics.insights.bestDay.netCents) : '—'),
    hint: (analytics) => (analytics.insights.bestDay ? dayLabel(analytics.insights.bestDay.date) : 'Sin días registrados'),
    tone: (analytics) => ((analytics.insights.bestDay?.netCents ?? 0) < 0 ? 'danger' : 'success'),
  },
  {
    key: 'lossDays',
    label: 'Días en pérdida',
    icon: 'alert-triangle',
    value: (analytics) => String(analytics.insights.lossDays),
    hint: () => 'con neto negativo',
    tone: (analytics) => (analytics.insights.lossDays > 0 ? 'danger' : 'success'),
  },
  {
    key: 'dataphoneShare',
    label: 'Peso del datáfono',
    icon: 'credit-card',
    value: (analytics) => percent(analytics.insights.dataphoneSharePercent),
    hint: (analytics) => `${money(analytics.month.dataphoneCents)} cobrado`,
  },
  {
    key: 'averageDailySales',
    label: 'Venta media diaria',
    icon: 'activity',
    value: (analytics) => money(analytics.insights.averageDailySalesCents),
    hint: () => 'por día registrado',
    tone: () => 'sales',
  },
  {
    key: 'averageDailyExpenses',
    label: 'Gasto medio diario',
    icon: 'minus-circle',
    value: (analytics) => money(analytics.insights.averageDailyExpensesCents),
    hint: () => 'por día registrado',
  },
  {
    key: 'projectedNet',
    label: 'Cierre proyectado',
    icon: 'trending-up',
    value: (analytics) => money(analytics.insights.projectedNetCents),
    hint: () => 'al ritmo actual',
    tone: (analytics) => ((analytics.insights.projectedNetCents ?? 0) < 0 ? 'danger' : 'success'),
  },
];

const DEFAULT_INSIGHTS: InsightKey[] = ['bestDay', 'lossDays', 'dataphoneShare', 'projectedNet'];

function useToneColor() {
  const { theme } = useTheme();
  return (tone: Tone): string => {
    switch (tone) {
      case 'success':
        return theme.colors.success;
      case 'danger':
        return theme.colors.danger;
      case 'muted':
        return theme.colors.mutedText;
      case 'sales':
        return theme.colors.sales;
      case 'investment':
        return theme.colors.investment;
      default:
        return theme.colors.text;
    }
  };
}

function Toggle({
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
        styles.toggle,
        {
          backgroundColor: active ? theme.colors.card : theme.colors.surface,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radius.md,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text
        style={[styles.toggleText, { color: active ? theme.colors.primary : theme.colors.mutedText }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MonthButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthButton,
        {
          borderColor: theme.colors.border,
          borderRadius: theme.radius.sm,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather name={icon} size={14} color={theme.colors.text} />
    </Pressable>
  );
}

function KpiTile({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  const { theme } = useTheme();
  const color = useToneColor()(tone);

  return (
    <View
      style={[
        styles.kpi,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={styles.kpiHeading}>
        <Feather name={icon} size={13} color={theme.colors.primary} />
        <Text style={[styles.kpiLabel, { color: theme.colors.mutedText }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.kpiHint, { color: theme.colors.mutedText }]} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <View style={styles.panelHeading}>
        <View style={[styles.panelIcon, { backgroundColor: theme.colors.card, borderRadius: theme.radius.sm }]}>
          <Feather name={icon} size={14} color={theme.colors.primary} />
        </View>
        <View style={styles.grow}>
          <Text style={[styles.panelTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.panelSubtitle, { color: theme.colors.mutedText }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function StatRow({
  label,
  value,
  tone = 'default',
  emphasis = false,
}: {
  label: string;
  value: string;
  tone?: Tone;
  emphasis?: boolean;
}) {
  const { theme } = useTheme();
  const color = useToneColor()(tone);

  return (
    <View style={[styles.row, emphasis ? [styles.rowEmphasis, { borderTopColor: theme.colors.border }] : null]}>
      <Text
        style={[styles.rowLabel, { color: emphasis ? theme.colors.text : theme.colors.mutedText }, emphasis ? styles.rowLabelStrong : null]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text style={[styles.rowValue, { color }, emphasis ? styles.rowValueStrong : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Bar({ value, color }: { value: number | null; color?: string }) {
  const { theme } = useTheme();
  const progress = Math.max(0, Math.min(100, value ?? 0));

  return (
    <View style={[styles.track, { backgroundColor: theme.colors.card }]}>
      <View style={[styles.progress, { width: `${progress}%`, backgroundColor: color ?? theme.colors.primary }]} />
    </View>
  );
}

function Chip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  const { theme } = useTheme();
  const color = useToneColor()(tone);

  return (
    <View style={[styles.chip, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <Text style={[styles.chipValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.chipLabel, { color: theme.colors.mutedText }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function LogisticsDashboard({
  analytics,
  monthLabel,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onPreviousMonth,
  onNextMonth,
  isCurrentMonth,
}: {
  analytics: LogisticsAnalytics;
  monthLabel: string;
  categories: { id: number; name: string }[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  isCurrentMonth: boolean;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { stock, sales, month } = analytics;
  const netTone: Tone = month.netCents < 0 ? 'danger' : month.netCents > 0 ? 'success' : 'default';
  const maxCategoryValue = Math.max(1, ...stock.topCategories.map((category) => category.retailCents));
  const scopedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;
  const [activeInsights, setActiveInsights] = useState<InsightKey[]>(DEFAULT_INSIGHTS);
  const visibleInsights = INSIGHTS.filter((insight) => activeInsights.includes(insight.key));

  const toggleInsight = (key: InsightKey) =>
    setActiveInsights((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  return (
    <View style={styles.root}>
      <FadeIn>
        <View style={styles.heading}>
          <View style={styles.grow}>
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>PANEL DE CONTROL</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>Logística y contabilidad</Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
              {monthLabel} · inventario, margen y resultado del mes
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md }]}>
            <View style={[styles.dot, { backgroundColor: month.trackedDays > 0 ? theme.colors.success : theme.colors.mutedText }]} />
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>
              {month.trackedDays > 0 ? `${month.trackedDays} días` : 'Sin registros'}
            </Text>
          </View>
        </View>
      </FadeIn>

      <FadeIn delay={staggerDelay(1)}>
        <View style={styles.toolbar}>
          <View style={styles.monthPicker}>
            <MonthButton icon="chevron-left" label="Mes anterior" onPress={onPreviousMonth} />
            <Text style={[styles.monthLabel, { color: theme.colors.text }]} numberOfLines={1}>
              {monthLabel}
            </Text>
            <MonthButton icon="chevron-right" label="Mes siguiente" onPress={onNextMonth} disabled={isCurrentMonth} />
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: theme.colors.mutedText }]}>Inventario y ventas</Text>
            <Toggle label="Todo" active={selectedCategoryId === null} onPress={() => onSelectCategory(null)} />
            {categories.map((category) => (
              <Toggle
                key={category.id}
                label={category.name}
                active={selectedCategoryId === category.id}
                onPress={() => onSelectCategory(category.id)}
              />
            ))}
          </View>
          {scopedCategory ? (
            <Text style={[styles.note, { color: theme.colors.mutedText }]}>El resultado del mes sigue mostrando toda la tienda.</Text>
          ) : null}
        </View>
      </FadeIn>

      <FadeIn delay={staggerDelay(2)}>
        <View style={styles.toolbar}>
          <Text style={[styles.filterLabel, { color: theme.colors.mutedText }]}>Insights</Text>
          {INSIGHTS.map((insight) => (
            <Toggle
              key={insight.key}
              label={insight.label}
              active={activeInsights.includes(insight.key)}
              onPress={() => toggleInsight(insight.key)}
            />
          ))}
        </View>

        {visibleInsights.length > 0 ? (
          <View style={[styles.kpiGrid, desktop ? styles.kpiGridDesktop : null]}>
            {visibleInsights.map((insight) => (
              <KpiTile
                key={insight.key}
                icon={insight.icon}
                label={insight.label}
                value={insight.value(analytics)}
                hint={insight.hint(analytics)}
                tone={insight.tone?.(analytics)}
              />
            ))}
          </View>
        ) : null}
      </FadeIn>

      <FadeIn delay={staggerDelay(3)}>
        <View style={[styles.kpiGrid, desktop ? styles.kpiGridDesktop : null]}>
          <KpiTile
            icon="shopping-bag"
            label="Ventas del mes"
            value={money(month.salesCents)}
            hint={month.trackedDays > 0 ? `${month.trackedDays} días registrados` : 'Registrá el día para verlo'}
            tone="sales"
          />
          <KpiTile
            icon="percent"
            label="Margen bruto"
            value={percent(month.grossMarginPercent)}
            hint={money(month.grossCents)}
            tone={month.grossCents < 0 ? 'danger' : 'success'}
          />
          <KpiTile
            icon="trending-up"
            label="Beneficio neto"
            value={money(month.netCents)}
            hint={`Margen ${percent(month.netMarginPercent)}`}
            tone={netTone}
          />
          <KpiTile
            icon="package"
            label="Capital en stock"
            value={money(stock.inventoryCostCents)}
            hint={`${stock.unitsAvailable} unidades a coste`}
            tone="investment"
          />
        </View>
      </FadeIn>

      <View style={[styles.panelGrid, desktop ? styles.panelGridDesktop : null]}>
        <FadeIn delay={staggerDelay(4)} style={styles.panelCell}>
          <Panel title="Cuenta de resultados" subtitle={`Estimación de ${monthLabel}`} icon="file-text">
            <StatRow label="Ventas cobradas" value={money(month.salesCents)} />
            <StatRow label="Coste de ventas" value={money(month.costCents)} />
            <StatRow label="Beneficio bruto" value={`${money(month.grossCents)} · ${percent(month.grossMarginPercent)}`} />
            <StatRow label="Gastos del mes" value={money(month.expensesCents)} tone="danger" />
            <StatRow label="Beneficio neto" value={money(month.netCents)} tone={netTone} emphasis />
            <StatRow label="Salario estimado (30%)" value={money(month.salaryCents)} tone="investment" />
            <StatRow label="Promedio diario neto" value={money(month.averageDailyNetCents)} />
            <StatRow
              label="Punto de equilibrio"
              value={month.breakEvenSalesCents == null ? '—' : money(month.breakEvenSalesCents)}
            />
            {month.breakEvenUnits != null ? (
              <Text style={[styles.note, { color: theme.colors.mutedText }]}>
                Equivale a unas {month.breakEvenUnits} ventas al ticket medio actual para cubrir los gastos del mes.
              </Text>
            ) : null}
            <Text style={[styles.note, { color: theme.colors.mutedText }]}>
              Basado en los registros diarios. No incluye impuestos ni amortizaciones.
            </Text>
          </Panel>
        </FadeIn>

        <FadeIn delay={staggerDelay(5)} style={styles.panelCell}>
          <Panel
            title="Operación de stock"
            subtitle={scopedCategory ? `Inventario de ${scopedCategory.name}` : 'Inventario actual y rotación'}
            icon="layers"
          >
            <View style={styles.barHeading}>
              <Text style={[styles.rowLabel, { color: theme.colors.mutedText }]}>Vendido sobre lo registrado</Text>
              <Text style={[styles.barValue, { color: theme.colors.primary }]}>{percent(stock.sellThroughPercent)}</Text>
            </View>
            <Bar value={stock.sellThroughPercent} />
            <View style={styles.splitNumbers}>
              <View style={styles.grow}>
                <Text style={[styles.number, { color: theme.colors.text }]}>{stock.unitsAvailable}</Text>
                <Text style={[styles.numberLabel, { color: theme.colors.mutedText }]}>disponibles</Text>
              </View>
              <View style={styles.grow}>
                <Text style={[styles.number, { color: theme.colors.text }]}>{stock.unitsSold}</Text>
                <Text style={[styles.numberLabel, { color: theme.colors.mutedText }]}>vendidas</Text>
              </View>
              <View style={styles.grow}>
                <Text style={[styles.number, { color: theme.colors.text }]}>{stock.unitsTotal}</Text>
                <Text style={[styles.numberLabel, { color: theme.colors.mutedText }]}>registradas</Text>
              </View>
            </View>
            <StatRow label="Valor a coste" value={money(stock.inventoryCostCents)} tone="investment" />
            <StatRow label="Valor a precio de venta" value={money(stock.retailValueCents)} />
            <StatRow
              label="Margen potencial"
              value={`${money(stock.potentialMarginCents)} · ${percent(stock.potentialMarginPercent)}`}
              tone={(stock.potentialMarginCents ?? 0) < 0 ? 'danger' : 'success'}
              emphasis
            />
            <StatRow label="Precio medio de venta" value={stock.unitsAvailable > 0 ? money(stock.averageSalePriceCents) : '—'} />
            <StatRow label="Recuperación de la inversión" value={percent(sales.recoveryPercent)} />
          </Panel>
        </FadeIn>
      </View>

      <View style={[styles.panelGrid, desktop ? styles.panelGridDesktop : null]}>
        <FadeIn delay={staggerDelay(6)} style={styles.panelCell}>
          <Panel title="Capital por tipo de joya" subtitle="Dónde está parado el dinero" icon="pie-chart">
            {stock.topCategories.length === 0 ? (
              <Text style={[styles.note, { color: theme.colors.mutedText }]}>Todavía no hay stock registrado.</Text>
            ) : (
              stock.topCategories.map((category) => (
                <View key={category.categoryId} style={styles.categoryRow}>
                  <View style={styles.categoryHeading}>
                    <Text style={[styles.rowLabel, { color: theme.colors.text }]} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={[styles.categoryValue, { color: theme.colors.text }]}>{formatEuros(category.retailCents)}</Text>
                  </View>
                  <Bar value={Math.round((100 * category.retailCents) / maxCategoryValue)} />
                  <Text style={[styles.categoryHint, { color: theme.colors.mutedText }]}>
                    {category.units} {category.units === 1 ? 'unidad' : 'unidades'} · coste {money(category.costCents)}
                  </Text>
                </View>
              ))
            )}
          </Panel>
        </FadeIn>

        <FadeIn delay={staggerDelay(7)} style={styles.panelCell}>
          <Panel title="Control y alertas" subtitle="Lo que pide atención" icon="alert-circle">
            <View style={styles.chipGrid}>
              <Chip
                label="grupos con stock bajo"
                value={String(stock.lowStockGroups)}
                tone={stock.lowStockGroups > 0 ? 'danger' : 'success'}
              />
              <Chip
                label="grupos sin unidades"
                value={String(stock.outOfStockGroups)}
                tone={stock.outOfStockGroups > 0 ? 'danger' : 'success'}
              />
              <Chip
                label="grupos sin coste"
                value={String(stock.groupsWithoutCost)}
                tone={stock.groupsWithoutCost > 0 ? 'investment' : 'success'}
              />
              <Chip label="ticket medio histórico" value={money(sales.averageTicketCents)} />
              <Chip
                label="margen bruto realizado"
                value={percent(sales.grossMarginPercent)}
                tone={(sales.grossMarginPercent ?? 0) < 0 ? 'danger' : 'success'}
              />
              <Chip label="ventas con datáfono" value={money(month.dataphoneCents)} />
            </View>
            {stock.unitsWithoutCost > 0 ? (
              <Text style={[styles.note, { color: theme.colors.danger }]}>
                {stock.unitsWithoutCost} unidades sin coste de compra: el margen y el capital quedan pendientes hasta completarlos.
              </Text>
            ) : (
              <Text style={[styles.note, { color: theme.colors.mutedText }]}>
                Todo el stock tiene coste de compra registrado.
              </Text>
            )}
          </Panel>
        </FadeIn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthButton: { width: 30, height: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 13, fontWeight: '700' },
  filterGroup: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  filterLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginRight: 2 },
  toggle: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 180 },
  toggleText: { fontSize: 12, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiGridDesktop: { flexWrap: 'nowrap' },
  kpi: { flexGrow: 1, flexBasis: 150, minWidth: 0, borderWidth: 1, padding: 12, gap: 3 },
  kpiHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLabel: { flex: 1, fontSize: 12, fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  kpiHint: { fontSize: 12 },
  panelGrid: { gap: 10 },
  panelGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  panelCell: { flex: 1, minWidth: 0 },
  panel: { borderWidth: 1, padding: 14, gap: 9 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 2 },
  panelIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  panelTitle: { fontSize: 15, fontWeight: '700' },
  panelSubtitle: { fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 22 },
  rowEmphasis: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7, marginTop: 1 },
  rowLabel: { flex: 1, fontSize: 13, lineHeight: 18 },
  rowLabelStrong: { fontWeight: '700' },
  rowValue: { flexShrink: 1, fontSize: 13, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowValueStrong: { fontSize: 15, fontWeight: '700' },
  barHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  barValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 4 },
  splitNumbers: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  number: { fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numberLabel: { fontSize: 11 },
  note: { fontSize: 11.5, lineHeight: 16 },
  categoryRow: { gap: 5 },
  categoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryValue: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  categoryHint: { fontSize: 11.5 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 1 },
  chipValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chipLabel: { fontSize: 11 },
});
