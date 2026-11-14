import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { toIsoDate } from '../../../../core/utils/date';

interface QuickAction {
  label: string;
  emoji: string;
  href: string;
}

const ACTIONS: QuickAction[] = [
  { label: 'Registrar día hoy', emoji: '📝', href: '' },
  { label: 'Invertir hoy', emoji: '💰', href: '/investment/purchase' },
  { label: 'Calendario', emoji: '📅', href: '/calendar' },
];

export function QuickActionRow() {
  const { theme } = useTheme();
  const router = useRouter();

  const handlePress = (action: QuickAction) => {
    if (action.href === '') {
      router.push(`/day/${toIsoDate(new Date())}` as never);
    } else if (action.href === '/investment/purchase') {
      router.push(`/investment/purchase?date=${toIsoDate(new Date())}` as never);
    } else {
      router.push(action.href as never);
    }
  };

  return (
    <View style={styles.row}>
      {ACTIONS.map((action) => {
        const isInvestir = action.href === '/investment/purchase';

        return (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.action,
              {
                backgroundColor: isInvestir ? theme.colors.success : theme.colors.primary,
                borderRadius: theme.radius.md,
              },
              pressed ? styles.pressed : null,
            ]}
            onPress={() => handlePress(action)}
          >
            <Text style={styles.emoji}>{action.emoji}</Text>
            <Text style={styles.label}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  emoji: {
    fontSize: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
