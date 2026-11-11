import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useTheme } from "../../../../core/theme/ThemeProvider";
import {
  isSameMonth,
  parseIsoDate,
  toIsoDate,
} from "../../../../core/utils/date";
import {
  createInitialMonthlyCalendarState,
  monthlyCalendarReducer,
} from "../calendar/monthlyCalendarState";
import { MonthlyCalendar } from "../components/MonthlyCalendar";
import { useMonthlyCalendarRecords } from "../hooks/useMonthlyCalendarRecords";
import { useCalendarHolidays } from "../../../holidays/presentation/hooks/useCalendarHolidays";
import {
  buildDayRouteFromIso,
  buildInvestmentPurchaseRouteFromIso,
} from "../calendar/dayRoute";
import {
  createInitialMonthParamConsumeState,
  decideMonthParamApplication,
} from "../calendar/monthParam";
import { SafeAreaView } from "react-native-safe-area-context";

export function CalendarScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ month?: string }>();
  const today = useMemo(() => new Date(), []);
  const [dayActionIso, setDayActionIso] = useState<string | null>(null);
  const [calendarState, dispatch] = useReducer(
    monthlyCalendarReducer,
    today,
    createInitialMonthlyCalendarState,
  );
  const calendarStateRef = useRef(calendarState);
  calendarStateRef.current = calendarState;
  const monthParamStateRef = useRef(createInitialMonthParamConsumeState());

  useFocusEffect(
    useCallback(() => {
      const decision = decideMonthParamApplication(
        monthParamStateRef.current,
        params.month,
      );
      monthParamStateRef.current = decision.next;

      if (!decision.apply || !decision.target) {
        return;
      }

      const target = decision.target;
      if (!isSameMonth(calendarStateRef.current.visibleMonth, target)) {
        dispatch({ type: "showMonth", date: target });
      }

      router.setParams({ month: undefined });
    }, [params.month, router]),
  );

  const monthlyRecords = useMonthlyCalendarRecords(calendarState.visibleMonth);
  const { holidaysByIso } = useCalendarHolidays(calendarState.visibleMonth);
  const activeError = monthlyRecords.error;
  const activeRefresh = monthlyRecords.refresh;
  const activeSelectedIso = calendarState.selectedDateIso;
  const targetDateIso = activeSelectedIso ?? toIsoDate(today);
  const actionDateLabel = parseIsoDate(targetDateIso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const horizontalPadding = Math.min(
    theme.spacing.lg,
    Math.max(theme.spacing.md, width * 0.06),
  );

  if (activeError) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[
          styles.safeArea,
          { backgroundColor: theme.colors.calendarBackground },
        ]}
      >
        <View style={styles.errorState} accessibilityLiveRegion="polite">
          <Text style={[styles.error, { color: theme.colors.danger }]}>
            {activeError}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.sm,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
              pressed ? styles.buttonPressed : null,
            ]}
            onPress={() => void activeRefresh()}
          >
              <Text style={[styles.retryButtonText, { color: theme.colors.onPrimary }]}>Reintentar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.calendarBackground },
      ]}
    >
      <ScrollView
        style={[
          styles.screenContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <View style={styles.pageHeader}>
          <Text
            style={[
              styles.pageTitle,
              { color: theme.colors.text, fontFamily: theme.typography.serifFamily },
            ]}
          >
            Calendario
          </Text>
        </View>
        <MonthlyCalendar
          visibleMonth={calendarState.visibleMonth}
          selectedDateIso={calendarState.selectedDateIso}
          recordsByIso={monthlyRecords.recordsByIso}
          holidaysByIso={holidaysByIso}
          showInitialLoadingOverlay={monthlyRecords.loading}
          onPreviousMonth={() => dispatch({ type: "previousMonth" })}
          onNextMonth={() => dispatch({ type: "nextMonth" })}
          onShowToday={() => dispatch({ type: "showMonth", date: new Date() })}
          onSelectDate={(iso) => {
            dispatch({ type: "selectDate", iso });
            setDayActionIso(iso);
          }}
        />

        <View style={styles.dayActions}>
          <Text
            style={[styles.dayActionsLabel, { color: theme.colors.calendarMutedText }]}
          >
            Acciones para {actionDateLabel}
          </Text>
          <View style={styles.dayActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Registrar día para ${targetDateIso}`}
              style={({ pressed }) => [
                styles.dayActionButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.sm,
                  borderColor: theme.colors.primary,
                },
                pressed ? styles.buttonPressed : null,
              ]}
              onPress={() => router.push(buildDayRouteFromIso(targetDateIso) as never)}
            >
              <Text style={[styles.dayActionText, { color: theme.colors.onPrimary }]}>Registrar ventas</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Registrar inversión para ${targetDateIso}`}
              style={({ pressed }) => [
                styles.dayActionButton,
                {
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                },
                pressed ? styles.buttonPressed : null,
              ]}
              onPress={() =>
                router.push(buildInvestmentPurchaseRouteFromIso(targetDateIso) as never)
              }
            >
              <Text style={[styles.dayActionText, { color: theme.colors.primary }]}>Registrar inversión</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={dayActionIso !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDayActionIso(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDayActionIso(null)}>
          <Pressable
            accessibilityRole="menu"
            onPress={(event) => event.stopPropagation()}
            style={[styles.actionMenu, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
          >
            <Text style={[styles.actionMenuTitle, { color: theme.colors.text }]}>
              {dayActionIso ? parseIsoDate(dayActionIso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => { if (dayActionIso) router.push(buildDayRouteFromIso(dayActionIso) as never); setDayActionIso(null); }} style={styles.menuAction}>
              <Text style={[styles.dayActionText, { color: theme.colors.primary }]}>Registrar ventas</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (dayActionIso) router.push(buildInvestmentPurchaseRouteFromIso(dayActionIso) as never); setDayActionIso(null); }} style={styles.menuAction}>
              <Text style={[styles.dayActionText, { color: theme.colors.primary }]}>Registrar inversión</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setDayActionIso(null)} style={styles.menuAction}>
              <Text style={[styles.dayActionText, { color: theme.colors.calendarMutedText }]}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
  },
  pageHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pageTitle: {
    fontSize: 26,
    flexShrink: 1,
  },
  error: {
    fontWeight: "600",
    textAlign: "center",
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  retryButton: {},
  retryButtonText: {
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.65,
  },
  dayActions: {
    marginTop: 2,
    gap: 6,
  },
  dayActionsLabel: {
    fontSize: 13,
  },
  dayActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayActionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dayActionText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" },
  actionMenu: { borderWidth: 1, padding: 18, gap: 8 },
  actionMenuTitle: { fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  menuAction: { minHeight: 48, alignItems: "center", justifyContent: "center", padding: 8 },
});
