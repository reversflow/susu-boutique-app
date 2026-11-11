import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { formatSpanishShortDate, parseIsoDate } from '../../../../core/utils/date';
import { useUpcomingHolidays } from '../../../holidays/presentation/hooks/useUpcomingHolidays';

export function UpcomingHolidaysCard() {
  const { theme } = useTheme();
  const router = useRouter();
  const { loading, holidays, error, refresh } = useUpcomingHolidays(null, 1);
  const nextHoliday = holidays[0];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.serifFamily }]}>Próximos festivos</Text>

      {loading ? (
        <Text style={[styles.stateText, { color: theme.colors.mutedText }]}>Cargando festivos...</Text>
      ) : !nextHoliday ? (
        <View style={styles.stateRow}>
          <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.stateText, { color: error ? theme.colors.danger : theme.colors.mutedText }]}>
            {error ? 'No se pudieron cargar los festivos.' : 'No hay festivos nacionales en el calendario disponible.'}
          </Text>
          {error ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reintentar cargar festivos"
              onPress={() => void refresh()}
              style={styles.action}
            >
              <Text style={[styles.link, { color: theme.colors.primary }]}>Reintentar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          {error ? (
            <View style={styles.stateRow}>
              <Text accessibilityRole="alert" style={[styles.warning, { color: theme.colors.danger }]}>No se pudo actualizar; se muestra el último dato guardado.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reintentar actualizar festivos"
                onPress={() => void refresh()}
                style={styles.action}
              >
                <Text style={[styles.link, { color: theme.colors.primary }]}>Reintentar</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={[styles.holidayName, { color: theme.colors.investment }]}>{nextHoliday.name}</Text>
          <Text style={[styles.holidayDate, { color: theme.colors.text }]}>
            {formatSpanishShortDate(parseIsoDate(nextHoliday.date))}{nextHoliday.daysUntil <= 1 ? '' : ` · En ${nextHoliday.daysUntil} días`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver calendario completo"
            style={({ pressed }) => [styles.action, pressed ? styles.linkPressed : null]}
            onPress={() => router.push('/calendar' as never)}
          >
            <Text style={[styles.link, { color: theme.colors.primary }]}>Ver calendario →</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  title: {
    fontSize: 23,
    lineHeight: 30,
  },
  holidayName: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
  },
  holidayDate: {
    fontSize: 15,
    lineHeight: 22,
    textTransform: 'capitalize',
  },
  stateText: {
    flex: 1,
    fontSize: 14,
  },
  warning: {
    flex: 1,
    fontSize: 13,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  link: {
    minHeight: 40,
    textAlignVertical: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  linkPressed: {
    opacity: 0.6,
  },
  action: {
    minHeight: 40,
    justifyContent: 'center',
  },
});
