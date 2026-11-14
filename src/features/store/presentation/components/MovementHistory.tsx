import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { summarizeMovements } from '../../domain/movementHistory';
import type { StockMovement, StockMovementType } from '../../domain/types';
import { formatEuros } from './StoreComponents';

const KINDS: Record<StockMovementType, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  venta: { label: 'Venta', icon: 'shopping-bag' },
  entrada: { label: 'Compra', icon: 'truck' },
  ajuste: { label: 'Ajuste', icon: 'sliders' },
};

export const MOVEMENT_FILTERS = [
  { key: 'todo', label: 'Todo' },
  { key: 'venta', label: 'Ventas' },
  { key: 'entrada', label: 'Compras' },
  { key: 'ajuste', label: 'Ajustes' },
] as const;

export type MovementFilter = (typeof MOVEMENT_FILTERS)[number]['key'];

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayOf(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function movementTimeLabel(iso: string): string {
  const date = toDate(iso);
  return date ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : iso;
}

/** "Hoy · 14:32" in the compact panel, where movements are not grouped by day. */
export function movementWhenLabel(iso: string): string {
  const date = toDate(iso);
  if (!date) return iso;
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (isSameDay(date, today)) return `Hoy · ${movementTimeLabel(iso)}`;
  if (isSameDay(date, yesterday)) return `Ayer · ${movementTimeLabel(iso)}`;
  return `${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · ${movementTimeLabel(iso)}`;
}

/** "Hoy", "Ayer" or the full weekday date for the history day headers. */
export function movementDayLabel(day: string): string {
  const date = dayOf(day);
  if (Number.isNaN(date.getTime())) return day;
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (isSameDay(date, today)) return 'Hoy';
  if (isSameDay(date, yesterday)) return 'Ayer';
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function amountCents(movement: StockMovement): number | null {
  if (movement.movementType === 'venta') return movement.chargedTotalCents ?? null;
  if (movement.movementType === 'entrada') return movement.costTotalCents ?? null;
  return null;
}

export function MovementRow({
  movement,
  timeLabel,
}: {
  movement: StockMovement;
  timeLabel: string;
}) {
  const { theme } = useTheme();
  const kind = KINDS[movement.movementType];
  const amount = amountCents(movement);
  const tone = movement.movementType === 'venta'
    ? theme.colors.sales
    : movement.movementType === 'entrada'
      ? theme.colors.investment
      : theme.colors.mutedText;

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <View style={[styles.badge, { backgroundColor: theme.colors.card, borderRadius: theme.radius.sm }]}>
        <Feather name={kind.icon} size={13} color={tone} />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {movement.categoryName} · {formatEuros(movement.priceCents)}
        </Text>
        <Text style={[styles.rowSub, { color: theme.colors.mutedText }]} numberOfLines={1}>
          {kind.label}
          {movement.supplierName ? ` · ${movement.supplierName}` : ''}
          {movement.note ? ` · ${movement.note}` : ''}
          {' · '}{timeLabel}
        </Text>
      </View>
      <View style={styles.rowSide}>
        <Text style={[styles.rowAmount, { color: amount == null ? theme.colors.mutedText : tone }]} numberOfLines={1}>
          {amount == null ? (movement.movementType === 'ajuste' ? '—' : 'Pendiente') : formatEuros(amount)}
        </Text>
        <Text style={[styles.rowUnits, { color: theme.colors.mutedText }]} numberOfLines={1}>
          {movement.unitsDelta > 0 ? '+' : ''}{movement.unitsDelta} u
        </Text>
      </View>
    </View>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.miniStat, { borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
      <Text style={[styles.miniStatValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.miniStatLabel, { color: theme.colors.mutedText }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Compact card for the logistics dashboard: totals of the visible movements plus the latest rows. */
export function RecentMovementsPanel({
  movements,
  scopeName,
  onOpenHistory,
}: {
  movements: StockMovement[];
  scopeName: string | null;
  onOpenHistory: () => void;
}) {
  const { theme } = useTheme();
  const totals = summarizeMovements(movements);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ver historial de movimientos"
      onPress={onOpenHistory}
      style={({ pressed }) => [
        styles.panel,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.panelHeading}>
        <View style={[styles.panelIcon, { backgroundColor: theme.colors.card, borderRadius: theme.radius.sm }]}>
          <Feather name="repeat" size={14} color={theme.colors.primary} />
        </View>
        <View style={styles.panelHeadingText}>
          <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Movimientos</Text>
          <Text style={[styles.panelSubtitle, { color: theme.colors.mutedText }]} numberOfLines={1}>
            {scopeName ?? 'Toda la tienda'} · {movements.length} recientes
          </Text>
        </View>
        <View style={styles.historyLink}>
          <Text style={[styles.historyLinkText, { color: theme.colors.primary }]}>Ver historial</Text>
          <Feather name="chevron-right" size={14} color={theme.colors.primary} />
        </View>
      </View>

      {movements.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.mutedText }]}>
          {scopeName
            ? `Sin movimientos de ${scopeName}.`
            : 'Todavía no hay movimientos de stock.'}
        </Text>
      ) : (
        <>
          <View style={styles.miniStats}>
            <MiniStat label="Ventas cobradas" value={formatEuros(totals.salesCents)} tone={theme.colors.sales} />
            <MiniStat label="Compras" value={totals.purchaseCents == null ? 'Pendiente' : formatEuros(totals.purchaseCents)} tone={theme.colors.investment} />
            <MiniStat
              label="Beneficio bruto"
              value={totals.profitCents == null ? 'Pendiente' : formatEuros(totals.profitCents)}
              tone={totals.profitCents != null && totals.profitCents < 0 ? theme.colors.danger : theme.colors.success}
            />
          </View>
          {movements.slice(0, 3).map((movement) => (
            <MovementRow key={movement.id} movement={movement} timeLabel={movementWhenLabel(movement.createdAt)} />
          ))}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, padding: 14, gap: 10 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  panelIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  panelHeadingText: { flex: 1, minWidth: 0, gap: 1 },
  panelTitle: { fontSize: 15, fontWeight: '700' },
  panelSubtitle: { fontSize: 12 },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  historyLinkText: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 13, lineHeight: 18, paddingVertical: 6 },
  miniStats: { flexDirection: 'row', gap: 8 },
  miniStat: { flex: 1, minWidth: 0, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 1 },
  miniStatValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  miniStatLabel: { fontSize: 11 },
  row: {
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  badge: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, lineHeight: 16 },
  rowSide: { alignItems: 'flex-end', gap: 1 },
  rowAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowUnits: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
});
