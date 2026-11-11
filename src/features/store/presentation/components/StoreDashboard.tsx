import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { calculateStoreDashboard } from '../../domain/storeDashboard';
import { parsePurchaseCost } from '../../domain/stockCost';
import { StoreDashboardSummary, StoreStockItem } from '../../domain/types';
import { formatEuros } from './StoreComponents';

type MetricProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  hint: string;
  help?: string;
  desktop: boolean;
};

function MetricCard({ icon, label, value, hint, help, desktop }: MetricProps) {
  const { theme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <View style={[
      styles.metricCard,
      desktop ? styles.metricDesktop : styles.metricMobile,
      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
    ]}>
      <View style={styles.metricHeading}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md }]}>
          <Feather name={icon} size={16} color={theme.colors.primary} />
        </View>
        <Text style={[styles.metricLabel, { color: theme.colors.mutedText }]}>{label}</Text>
        {help ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ayuda sobre ${label}`}
            accessibilityState={{ expanded: showHelp }}
            hitSlop={8}
            onPress={() => setShowHelp((current) => !current)}
            style={[styles.helpButton, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.helpSymbol, { color: theme.colors.primary }]}>?</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.metricValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.caption, { color: theme.colors.mutedText }]}>{hint}</Text>
      {showHelp ? <Text style={[styles.helpText, { color: theme.colors.text }]}>{help}</Text> : null}
    </View>
  );
}

function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const { theme } = useTheme();
  const progress = value ?? 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: progress }}
      style={[styles.track, { backgroundColor: theme.colors.card }]}
    >
      <View style={[styles.progress, { width: `${progress}%`, backgroundColor: theme.colors.primary }]} />
    </View>
  );
}

export function StoreDashboard({ stock, sales }: { stock: StoreStockItem[]; sales: StoreDashboardSummary }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [expanded, setExpanded] = useState(false);
  const [expenses, setExpenses] = useState('');
  const [showNetHelp, setShowNetHelp] = useState(false);
  const data = calculateStoreDashboard(stock, sales);
  const expenseCents = expenses.trim() ? parsePurchaseCost(expenses) : null;
  const text = { color: theme.colors.text };
  const muted = { color: theme.colors.mutedText };
  const money = (value: number | null) => value == null ? 'Pendiente' : formatEuros(value);
  const recoveryValue = data.total === 0
    ? 'Sin datos'
    : data.missingInvestment == null
      ? 'Pendiente'
      : data.missingInvestment === 0
        ? 'Recuperada'
        : formatEuros(data.missingInvestment);
  const stockValue = data.percentRemaining == null ? 'Sin datos' : `${data.percentRemaining}%`;
  const grossValue = data.total === 0 ? 'Sin datos' : money(data.realizedGross);
  const netEstimate = expenseCents == null || data.projectedGross == null ? null : data.projectedGross - expenseCents;
  const netValue = data.total === 0 || netEstimate == null || !Number.isSafeInteger(netEstimate)
    ? 'Pendiente'
    : formatEuros(netEstimate);
  const grossLabel = data.realizedGross != null && data.realizedGross < 0 ? 'Pérdida bruta actual' : 'Beneficio bruto actual';
  const projectedGrossLabel = data.projectedGross != null && data.projectedGross < 0 ? 'Pérdida bruta prevista' : 'Beneficio bruto previsto';
  const netLabel = netEstimate != null && netEstimate < 0 ? 'Pérdida neta estimada' : 'Neto previsto estimado';

  return (
    <View style={styles.dashboard}>
      <View style={styles.dashboardHeading}>
        <View style={styles.grow}>
          <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>RESUMEN DE TIENDA</Text>
          <Text style={[styles.dashboardTitle, text]}>Tu negocio, claro</Text>
          <Text style={[styles.dashboardSubtitle, muted]}>Datos acumulados desde el primer registro</Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg }]}>
          <View style={[styles.liveDot, { backgroundColor: theme.colors.success }]} />
          <Text style={[styles.liveText, text]}>Actualizado</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard icon="package" label="Stock disponible" value={stockValue} hint={data.total > 0 ? `${data.remaining} de ${data.total} unidades` : 'Añade stock para empezar'} desktop={desktop} />
        <MetricCard icon="credit-card" label="Ventas cobradas" value={formatEuros(sales.revenueCents)} hint={`${sales.unitsSold} ${sales.unitsSold === 1 ? 'unidad vendida' : 'unidades vendidas'}`} desktop={desktop} />
        <MetricCard icon="target" label="Para recuperar la compra" value={recoveryValue} hint={data.recoveryPercent == null ? 'Faltan datos de coste' : `${data.recoveryPercent}% recuperado`} desktop={desktop} />
        <MetricCard icon="trending-up" label={grossLabel} value={grossValue} hint="Sobre ventas ya cobradas" help="Ventas cobradas menos el coste de compra de las joyas vendidas. No descuenta otros gastos." desktop={desktop} />
      </View>

      <View style={[styles.overviewGrid, desktop ? styles.overviewDesktop : styles.overviewMobile]}>
        <View style={[styles.primaryPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
          <View style={styles.panelHeading}>
            <View style={styles.grow}>
              <Text style={[styles.panelTitle, text]}>Recuperación de la inversión</Text>
              <Text style={[styles.caption, muted]}>Ventas cobradas frente al coste total de las joyas</Text>
            </View>
            <Text style={[styles.panelPercent, { color: theme.colors.primary }]}>{data.recoveryPercent == null ? '—' : `${data.recoveryPercent}%`}</Text>
          </View>
          <ProgressBar value={data.recoveryPercent} label="Progreso para recuperar la inversión" />
          <View style={styles.splitValues}>
            <View style={styles.grow}>
              <Text style={[styles.caption, muted]}>Cobrado</Text>
              <Text style={[styles.panelValue, text]}>{formatEuros(sales.revenueCents)}</Text>
            </View>
            <View style={styles.alignEnd}>
              <Text style={[styles.caption, muted]}>Coste total</Text>
              <Text style={[styles.panelValue, text]}>{money(data.investment)}</Text>
            </View>
          </View>
          <View style={[styles.statusLine, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md }]}>
            <Feather name={data.missingInvestment === 0 && data.total > 0 ? 'check-circle' : 'clock'} size={17} color={theme.colors.primary} />
            <Text style={[styles.statusText, text]}>
              {data.total === 0 ? 'Añade stock para calcular el objetivo.' : data.missingInvestment == null ? 'Falta el coste de algunas unidades.' : data.missingInvestment === 0 ? 'La inversión en joyas está recuperada.' : `Faltan ${formatEuros(data.missingInvestment)} para recuperarla.`}
            </Text>
          </View>
        </View>

        <View style={[styles.secondaryPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
          <View style={styles.panelHeading}>
            <View style={styles.grow}>
              <Text style={[styles.panelTitle, text]}>Estado del stock</Text>
              <Text style={[styles.caption, muted]}>Unidades disponibles respecto al total registrado</Text>
            </View>
            <Text style={[styles.panelPercent, { color: theme.colors.primary }]}>{data.percentRemaining == null ? '—' : `${data.percentRemaining}%`}</Text>
          </View>
          <ProgressBar value={data.percentRemaining} label="Porcentaje de stock disponible" />
          <View style={styles.stockNumbers}>
            <View><Text style={[styles.stockNumber, text]}>{data.remaining}</Text><Text style={[styles.caption, muted]}>disponibles</Text></View>
            <View style={[styles.verticalRule, { backgroundColor: theme.colors.border }]} />
            <View><Text style={[styles.stockNumber, text]}>{sales.unitsSold}</Text><Text style={[styles.caption, muted]}>vendidas</Text></View>
            <View style={[styles.verticalRule, { backgroundColor: theme.colors.border }]} />
            <View><Text style={[styles.stockNumber, text]}>{data.total}</Text><Text style={[styles.caption, muted]}>registradas</Text></View>
          </View>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((current) => !current)} style={[styles.detailsToggle, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
        <View style={styles.grow}>
          <Text style={[styles.toggleTitle, text]}>Beneficios y previsión</Text>
          <Text style={[styles.caption, muted]}>Costes, bruto previsto y estimación neta</Text>
        </View>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.primary} />
      </Pressable>

      {expanded ? (
        <View style={[styles.detailsPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
          <View style={[styles.detailColumns, desktop ? styles.detailColumnsDesktop : styles.detailColumnsMobile]}>
            <View style={styles.detailGroup}>
              <Text style={[styles.detailHeading, text]}>Costes registrados</Text>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, muted]}>Compra total de joyas</Text><Text style={[styles.detailValue, text]}>{money(data.investment)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, muted]}>Stock que aún queda</Text><Text style={[styles.detailValue, text]}>{money(data.inventoryCost)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, muted]}>Coste de lo vendido</Text><Text style={[styles.detailValue, text]}>{money(sales.soldCostCents)}</Text></View>
            </View>
            <View style={styles.detailGroup}>
              <Text style={[styles.detailHeading, text]}>Previsión a precio base</Text>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, muted]}>Ingresos totales previstos</Text><Text style={[styles.detailValue, text]}>{data.total === 0 ? 'Sin datos' : money(data.projectedRevenue)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, muted]}>{projectedGrossLabel}</Text><Text style={[styles.detailValue, text]}>{data.total === 0 ? 'Sin datos' : money(data.projectedGross)}</Text></View>
              <Text style={[styles.caption, muted]}>El precio pactado de futuras ventas puede cambiar esta previsión.</Text>
            </View>
          </View>

          <View style={[styles.netSection, { borderTopColor: theme.colors.border }]}>
            <View style={styles.netHeading}>
              <Text style={[styles.detailHeading, text]}>Estimación de beneficio neto</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Ayuda sobre beneficio neto estimado" accessibilityState={{ expanded: showNetHelp }} hitSlop={8} onPress={() => setShowNetHelp((current) => !current)} style={[styles.helpButton, { borderColor: theme.colors.border }]}>
                <Text style={[styles.helpSymbol, { color: theme.colors.primary }]}>?</Text>
              </Pressable>
            </View>
            {showNetHelp ? <Text style={[styles.helpText, text]}>Beneficio bruto previsto menos los gastos que escribas. Es una estimación y no se guarda.</Text> : null}
            <View style={[styles.netGrid, desktop ? styles.netGridDesktop : styles.netGridMobile]}>
              <View style={styles.expenseField}>
                <Text style={[styles.inputLabel, text]}>Otros gastos estimados (€)</Text>
                <TextInput accessibilityLabel="Otros gastos estimados en euros" value={expenses} onChangeText={setExpenses} keyboardType="decimal-pad" placeholder="Ej. 150,00" placeholderTextColor={theme.colors.mutedText} style={[styles.input, text, { borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, borderRadius: theme.radius.md }]} />
                <Text style={[styles.caption, muted]}>Este importe no se guarda.</Text>
              </View>
              <View style={[styles.netResult, { backgroundColor: theme.colors.card, borderRadius: theme.radius.md }]}>
                <Text style={[styles.caption, muted]}>{netLabel}</Text>
                <Text style={[styles.netValue, text]}>{netValue}</Text>
              </View>
            </View>
            {expenses.trim() && expenseCents == null ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>Introduce un importe válido, incluido 0.</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { gap: 16 },
  dashboardHeading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  grow: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 5 },
  dashboardTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  dashboardSubtitle: { fontSize: 14, marginTop: 3 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 13, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { borderWidth: 1, padding: 15, minHeight: 142, gap: 8 },
  metricDesktop: { flex: 1, minWidth: 185 },
  metricMobile: { width: '100%', minHeight: 126 },
  metricHeading: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  metricValue: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  caption: { fontSize: 13, lineHeight: 19 },
  helpButton: { width: 28, height: 28, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  helpSymbol: { fontSize: 14, fontWeight: '700' },
  helpText: { fontSize: 13, lineHeight: 19 },
  overviewGrid: { gap: 12 },
  overviewDesktop: { flexDirection: 'row' },
  overviewMobile: { flexDirection: 'column' },
  primaryPanel: { flex: 1.25, borderWidth: 1, padding: 18, gap: 16 },
  secondaryPanel: { flex: 1, borderWidth: 1, padding: 18, gap: 16 },
  panelHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  panelTitle: { fontSize: 17, fontWeight: '700' },
  panelPercent: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 9, borderRadius: 5, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 5 },
  splitValues: { flexDirection: 'row', gap: 16 },
  alignEnd: { alignItems: 'flex-end' },
  panelValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 3 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11 },
  statusText: { flex: 1, fontSize: 13, lineHeight: 18 },
  stockNumbers: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  stockNumber: { fontSize: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
  verticalRule: { width: 1, height: 34 },
  detailsToggle: { minHeight: 64, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontSize: 16, fontWeight: '700' },
  detailsPanel: { borderWidth: 1, padding: 18, gap: 18 },
  detailColumns: { gap: 24 },
  detailColumnsDesktop: { flexDirection: 'row' },
  detailColumnsMobile: { flexDirection: 'column' },
  detailGroup: { flex: 1, gap: 11 },
  detailHeading: { fontSize: 16, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  detailLabel: { flex: 1, fontSize: 14, lineHeight: 19 },
  detailValue: { flexShrink: 1, fontSize: 15, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  netSection: { borderTopWidth: 1, paddingTop: 18, gap: 12 },
  netHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  netGrid: { gap: 12 },
  netGridDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  netGridMobile: { flexDirection: 'column' },
  expenseField: { flex: 1.2, gap: 7 },
  inputLabel: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: 13, fontSize: 17 },
  netResult: { flex: 1, padding: 14, justifyContent: 'center' },
  netValue: { fontSize: 25, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  error: { fontSize: 14, lineHeight: 19 },
});
