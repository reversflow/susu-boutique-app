import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { isSameMonth } from "../../../../core/utils/date";
import { useTheme } from "../../../../core/theme/ThemeProvider";
import {
  buildMonthLabel,
  buildMonthlyCalendarWeeks,
  MONTHLY_CALENDAR_COLUMN_COUNT,
  MONTHLY_CELL_MIN_HEIGHT,
  WEEKDAY_LABELS_MONDAY_FIRST,
} from "../calendar/monthlyCalendarModel";
import {
  buildMonthlyDayAccessibilityHint,
  buildMonthlyDayAccessibilityLabel,
} from "../calendar/calendarA11y";
import { resolveMonthlyDayCellBorder } from "../calendar/monthlyCalendarVisualState";
import { DailyRecord } from "../../domain/types";

interface Props {
  visibleMonth: Date;
  selectedDateIso: string | null;
  recordsByIso: Map<string, DailyRecord>;
  holidaysByIso?: Map<string, string>;
  showInitialLoadingOverlay: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onShowToday: () => void;
  onSelectDate: (iso: string) => void;
}

const WEEKDAY_ROW_HEIGHT = 36;
const WEEKDAY_SUNDAY_INDEX = WEEKDAY_LABELS_MONDAY_FIRST.length - 1;

export function MonthlyCalendar({
  visibleMonth,
  selectedDateIso,
  recordsByIso,
  holidaysByIso,
  showInitialLoadingOverlay,
  onPreviousMonth,
  onNextMonth,
  onShowToday,
  onSelectDate,
}: Props) {
  const { theme } = useTheme();
  const weeks = buildMonthlyCalendarWeeks(visibleMonth, recordsByIso);
  const monthLabel = buildMonthLabel(visibleMonth);
  const isShowingCurrentMonth = isSameMonth(visibleMonth, new Date());

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Pressable
          style={({ pressed }) => [
            styles.monthButton,
            {
              borderRadius: theme.radius.sm,
              borderColor: theme.colors.calendarBorder,
            },
            pressed ? styles.controlPressed : null,
          ]}
          onPress={onPreviousMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
        >
          <Text
            style={[
              styles.monthButtonText,
              { color: theme.colors.calendarText },
            ]}
          >
            ‹
          </Text>
        </Pressable>

        <View style={styles.monthTitleArea}>
          <Text
            style={[styles.yearLabel, { color: theme.colors.calendarMutedText }]}
            numberOfLines={1}
          >
            {visibleMonth.getFullYear()}
          </Text>
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.calendarText,
                fontFamily: theme.typography.serifFamily,
              },
            ]}
            numberOfLines={1}
          >
            {monthLabel}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.monthButton,
            {
              borderRadius: theme.radius.sm,
              borderColor: theme.colors.calendarBorder,
            },
            pressed ? styles.controlPressed : null,
          ]}
          onPress={onNextMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
        >
          <Text
            style={[
              styles.monthButtonText,
              { color: theme.colors.calendarText },
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.legend}>
          <View
            style={[
              styles.recordDot,
              { backgroundColor: theme.colors.success },
            ]}
          />
          <Text
            style={[
              styles.legendLabel,
              { color: theme.colors.calendarMutedText },
            ]}
          >
            Con registro
          </Text>
        </View>

        {holidaysByIso ? (
          <View style={styles.legend}>
            <View
              style={[
                styles.holidayBar,
                { backgroundColor: theme.colors.danger },
              ]}
            />
            <Text
              style={[
                styles.legendLabel,
                { color: theme.colors.calendarMutedText },
              ]}
            >
              Festivo
            </Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.todayButton,
            {
              borderRadius: theme.radius.sm,
              paddingHorizontal: theme.spacing.sm,
            },
            isShowingCurrentMonth ? styles.todayButtonDisabled : null,
            pressed && !isShowingCurrentMonth ? styles.controlPressed : null,
            isShowingCurrentMonth
              ? { borderColor: theme.colors.calendarBorder }
              : { backgroundColor: theme.colors.calendarBorder },
          ]}
          onPress={onShowToday}
          disabled={isShowingCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel="Mostrar mes actual"
          accessibilityState={{ disabled: isShowingCurrentMonth }}
        >
          <Text
            style={[
              styles.todayButtonText,
              { color: theme.colors.calendarText },
              isShowingCurrentMonth ? styles.todayButtonTextDisabled : null,
            ]}
          >
            Hoy
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.calendarSurface,
          { backgroundColor: theme.colors.calendarSurface },
        ]}
      >
        <View
          style={[
            styles.weekdayRow,
            { borderBottomColor: theme.colors.calendarBorder },
          ]}
        >
          {WEEKDAY_LABELS_MONDAY_FIRST.map((label, index) => {
            const isSunday = index === WEEKDAY_SUNDAY_INDEX;

            return (
              <View key={label} style={styles.weekdayCell}>
                <Text
                  style={[
                    styles.weekdayHeader,
                    { color: theme.colors.calendarMutedText },
                    isSunday ? { color: theme.colors.primarySoft } : null,
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.grid}>
          {weeks.map((week, weekIndex) => {
            const isLastWeek = weekIndex === weeks.length - 1;

            return (
              <View
                key={week[0]?.iso ?? `week-${weekIndex}`}
                style={styles.weekRow}
              >
                {week.map((cell, dayIndex) => {
                  const hasRecord = cell.status === "filled";
                  const showEconomicSignal =
                    hasRecord &&
                    cell.isCurrentMonth &&
                    cell.economicSignal !== "none";
                  const showRecordDot = hasRecord && !showEconomicSignal;
                  const holidayName = holidaysByIso?.get(cell.iso);
                  const showHolidayIndicator =
                    Boolean(holidayName) && cell.isCurrentMonth;
                  const isLastColumn =
                    dayIndex === MONTHLY_CALENDAR_COLUMN_COUNT - 1;
                  const isSelected = selectedDateIso === cell.iso;
                  const dayAccessibilityLabel = buildMonthlyDayAccessibilityLabel(
                    cell.iso,
                    cell.status,
                    cell.isCurrentMonth,
                  );

                  return (
                    <View
                      key={cell.iso}
                      style={[
                        styles.dayCellSlot,
                        !isLastColumn ? styles.columnDivider : null,
                        !isLastWeek
                          ? [
                              styles.rowDivider,
                              {
                                borderBottomColor: theme.colors.calendarBorder,
                              },
                            ]
                          : null,
                      ]}
                    >
                      <Pressable
                          style={({ pressed }) => [
                            styles.dayCell,
                            { minHeight: Math.max(MONTHLY_CELL_MIN_HEIGHT, 60) },
                            cell.isCurrentMonth
                              ? styles.currentMonthCell
                              : styles.adjacentMonthCell,
                            cell.isToday ? styles.todayCell : null,
                            isSelected ? styles.selectedCell : null,
                            pressed ? styles.cellPressed : null,
                            {
                              borderRadius: theme.radius.sm,
                            },
                            resolveMonthlyDayCellBorder(
                              isSelected,
                              cell.isToday,
                              theme.colors.primary,
                              theme.colors.card,
                              theme.colors.calendarHighlight,
                            ),
                          ]}
                          onPress={() => onSelectDate(cell.iso)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            holidayName
                              ? `${dayAccessibilityLabel}, festivo ${holidayName}`
                              : dayAccessibilityLabel
                          }
                          accessibilityHint={buildMonthlyDayAccessibilityHint(
                            cell.status,
                            cell.isCurrentMonth,
                          )}
                        >
                          <View
                            style={[
                              styles.dayNumberBadge,
                              cell.isToday ? styles.todayBadge : null,
                              cell.isToday
                                ? {
                                    backgroundColor: theme.colors.primary,
                                  }
                                : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayNumber,
                                cell.isCurrentMonth
                                  ? styles.currentMonthText
                                  : styles.adjacentMonthText,
                                {
                                  color: cell.isToday
                                    ? theme.colors.onPrimary
                                    : cell.isCurrentMonth
                                      ? theme.colors.calendarText
                                      : theme.colors.calendarMutedText,
                                },
                              ]}
                            >
                              {cell.dayNumber}
                            </Text>
                          </View>

                          <View style={styles.recordIndicatorSlot}>
                            {showHolidayIndicator ? (
                              <View
                                style={[
                                  styles.holidayBar,
                                  {
                                    backgroundColor: theme.colors.danger,
                                  },
                                ]}
                              />
                            ) : null}

                            {showEconomicSignal ? (
                              <View
                                style={[
                                  styles.economicSignal,
                                  cell.economicSignal === "positive"
                                    ? styles.economicSignalPositive
                                    : null,
                                  cell.economicSignal === "negative"
                                    ? styles.economicSignalNegative
                                    : null,
                                  cell.economicSignal === "neutral"
                                    ? styles.economicSignalNeutral
                                    : null,
                                  cell.economicSignal === "positive"
                                    ? { backgroundColor: theme.colors.success }
                                    : null,
                                  cell.economicSignal === "negative"
                                    ? { backgroundColor: theme.colors.danger }
                                    : null,
                                  cell.economicSignal === "neutral"
                                    ? {
                                        backgroundColor:
                                          theme.colors.calendarMutedText,
                                      }
                                    : null,
                                ]}
                              />
                            ) : null}

                            {showRecordDot ? (
                              <View
                                style={[
                                  styles.recordDot,
                                  !cell.isCurrentMonth
                                    ? styles.adjacentRecordDot
                                    : null,
                                  { backgroundColor: theme.colors.success },
                                ]}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {showInitialLoadingOverlay ? (
          <View
            style={[
              styles.loadingOverlay,
              { backgroundColor: theme.colors.calendarLoadingOverlay },
            ]}
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator
              color={theme.colors.primary}
              accessibilityLabel={`Cargando ${monthLabel}`}
            />
            <Text
              style={[
                styles.loadingText,
                { color: theme.colors.calendarMutedText },
              ]}
            >
              Cargando mes...
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  monthButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: theme.colors.primary,
  },
  monthButtonText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "700",
  },
  controlPressed: {
    opacity: 0.62,
  },
  monthTitleArea: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
  },
  yearLabel: {
    fontSize: 13,
    letterSpacing: 4,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    lineHeight: 39,
    textTransform: "capitalize",
  },
  statusRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  todayButton: {
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  todayButtonDisabled: {
    borderWidth: 1,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  todayButtonTextDisabled: {
    opacity: 0.62,
  },
  calendarSurface: {
    flex: 0,
    position: "relative",
    overflow: "visible",
  },
  weekdayRow: {
    minHeight: WEEKDAY_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayHeader: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 13,
  },
  grid: {
    flexGrow: 0,
  },
  weekRow: {
    minHeight: Math.max(MONTHLY_CELL_MIN_HEIGHT, 60),
    flexDirection: "row",
  },
  dayCellSlot: {
    flex: 1,
  },
  dayCell: {
    flex: 1,
    minHeight: Math.max(MONTHLY_CELL_MIN_HEIGHT, 60),
    paddingVertical: 3,
    justifyContent: "space-between",
    alignItems: "center",
    // backgroundColor: theme.colors.primary,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  currentMonthCell: {
    // backgroundColor: theme.colors.primary,
  },
  adjacentMonthCell: {
    // backgroundColor: theme.colors.primary,
  },
  todayCell: {
    borderWidth: 1,
  },
  selectedCell: {
    borderWidth: 2,
  },
  columnDivider: {
    borderRightWidth: 0,
    borderRightColor: "transparent",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.09)",
  },
  cellPressed: {
    opacity: 0.58,
  },
  dayNumberBadge: {
    width: 28,
    height: 28,
    // borderRadius: 14; backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor: theme.colors.primary,
  },
  todayBadge: {
    borderRadius: 14,
  },
  dayNumber: {
    fontSize: 17,
    fontWeight: "700",
  },
  currentMonthText: {
    opacity: 1,
  },
  adjacentMonthText: {
    opacity: 0.55,
  },
  recordIndicatorSlot: {
    gap: 2,
    minHeight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  economicSignal: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  economicSignalPositive: {},
  economicSignalNegative: {},
  economicSignalNeutral: {},
  holidayBar: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  recordDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  adjacentRecordDot: {
    opacity: 0.45,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: WEEKDAY_ROW_HEIGHT,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
