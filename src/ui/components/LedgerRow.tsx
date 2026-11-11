import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

interface LedgerRowProps {
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  valueColor?: string;
}

export function LedgerRow({
  label,
  value,
  hint,
  onPress,
  accessibilityLabel,
  valueColor,
}: LedgerRowProps) {
  const { theme } = useTheme();
  const content = (
    <>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={styles.trailing}>
        <View style={styles.valueBlock}>
          {value ? (
            <Text style={[styles.value, { color: valueColor ?? theme.colors.text }]}>{value}</Text>
          ) : null}
          {hint ? (
            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>{hint}</Text>
          ) : null}
        </View>
        {onPress ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.chevron, { color: theme.colors.mutedText }]}
          >
            ›
          </Text>
        ) : null}
      </View>
    </>
  );
  const rowStyle = [styles.row, { borderBottomColor: theme.colors.border }];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}${value ? `, ${value}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    flexShrink: 1,
  },
  trailing: {
    maxWidth: '60%',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueBlock: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 16,
    textAlign: 'right',
    flexShrink: 1,
  },
  hint: {
    fontSize: 13,
    textAlign: 'right',
    flexShrink: 1,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  pressed: {
    opacity: 0.68,
  },
});
