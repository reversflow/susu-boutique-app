import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../../core/theme/ThemeProvider";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  valueColor?: string;
}

export function KpiCard({ label, value, hint, valueColor }: KpiCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          borderColor: theme.colors.border,
          padding: theme.spacing.compact,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.mutedText }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor ?? theme.colors.text }]}>{value}</Text>
      {hint ? <Text style={[styles.hint, { color: theme.colors.mutedText }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
    borderWidth: 1,
    gap: 4,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  hint: {
    fontSize: 12,
  },
});
