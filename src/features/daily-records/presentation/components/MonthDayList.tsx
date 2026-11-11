import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { daysInMonth, toIsoDate } from '../../../../core/utils/date';
import { formatCurrency } from '../../../../core/utils/currency';
import { DailyRecord } from '../../domain/types';
import { useTheme } from '../../../../core/theme/ThemeProvider';

interface Props {
  monthDate: Date;
  records: DailyRecord[];
}

function weekdayLabel(date: Date): string {
  return date.toLocaleDateString('es-ES', { weekday: 'short' });
}

export function MonthDayList({ monthDate, records }: Props) {
  const { theme } = useTheme();
  const map = new Map(records.map((r) => [r.date, r]));
  const days = daysInMonth(monthDate);

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Días del mes</Text>
      <View style={styles.list}>
        {days.map((day) => {
          const iso = toIsoDate(day);
          const record = map.get(iso);
          return (
            <Link href={`/day/${iso}` as never} asChild key={iso}>
              <Pressable
                style={[
                  styles.row,
                  {
                    borderRadius: theme.radius.md,
                    borderColor: theme.colors.border,
                    padding: theme.spacing.sm,
                    backgroundColor: theme.colors.inputBackground,
                  },
                ]}
              >
                <View style={styles.left}>
                  <Text style={[styles.dayNumber, { color: theme.colors.text }]}>{day.getDate()}</Text>
                  <Text style={[styles.weekday, { color: theme.colors.mutedText }]}>{weekdayLabel(day)}</Text>
                </View>
                <View style={styles.right}>
                  {record ? (
                    <>
                      <Text style={[styles.amount, { color: theme.colors.primary }]}>{formatCurrency(record.totalSold)}</Text>
                      <Text style={[styles.hint, { color: theme.colors.mutedText }]}>Con registro</Text>
                    </>
                  ) : (
                    <Text style={[styles.hint, { color: theme.colors.mutedText }]}>Sin registro</Text>
                  )}
                </View>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  list: {
    gap: 6,
  },
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '700',
    minWidth: 24,
  },
  weekday: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
  },
});
