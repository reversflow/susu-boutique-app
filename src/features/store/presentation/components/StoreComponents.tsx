import { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { StoreStockItem } from '../../domain/types';

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function grossProfitLabel(cents: number | null | undefined): string {
  return cents == null ? 'Beneficio bruto pendiente · falta coste de compra'
    : `${cents < 0 ? 'Pérdida bruta' : 'Beneficio bruto'} · ${formatEuros(Math.abs(cents))}`;
}

export function InventoryCostDetails({ item }: { item: StoreStockItem }) {
  const { theme } = useTheme();
  if (item.stockUnits === 0) return <Text style={{ color: theme.colors.mutedText }}>Sin unidades para valorar</Text>;
  if (item.inventoryCostCents == null) return <Text style={{ color: theme.colors.mutedText }}>Coste y margen pendientes · hay unidades sin coste de compra</Text>;
  const predicted = item.priceCents * item.stockUnits - item.inventoryCostCents;
  return <View style={{ gap: 4 }}>
    <Text style={{ color: theme.colors.mutedText }}>Coste medio restante · {formatEuros(item.inventoryCostCents / item.stockUnits)} / unidad</Text>
    <Text style={{ color: theme.colors.text }}>Valor de compra del stock · {formatEuros(item.inventoryCostCents)}</Text>
    <Text style={{ color: predicted < 0 ? theme.colors.danger : theme.colors.text }}>{grossProfitLabel(predicted)} previsto a precio base</Text>
  </View>;
}

export function StoreCard({
  children,
  onPress,
  disabled = false,
  selected = false,
  accessibilityLabel,
  style,
}: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}>) {
  const { theme } = useTheme();
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: selected ? theme.colors.card : theme.colors.surface,
      borderColor: selected ? theme.colors.primary : theme.colors.border,
      borderRadius: theme.radius.md,
    },
    style,
  ];

  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        cardStyle,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max,
  label = 'unidades',
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  label?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Restar una ${label}`}
        accessibilityState={{ disabled: value <= 0 }}
        disabled={value <= 0}
        style={({ pressed }) => [
          styles.stepperButton,
          { borderColor: theme.colors.border, borderRadius: theme.radius.md },
          pressed ? styles.pressed : null,
          value <= 0 ? styles.disabled : null,
        ]}
        onPress={() => onChange(value - 1)}
      >
        <Text style={[styles.stepperSymbol, { color: theme.colors.text }]}>−</Text>
      </Pressable>
      <View style={styles.stepperValue}>
        <Text accessibilityLabel={`${value} ${label}`} style={[styles.stepperNumber, { color: theme.colors.text }]}>
          {value}
        </Text>
        <Text style={[styles.stepperLabel, { color: theme.colors.mutedText }]}>{label}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sumar una ${label}`}
        accessibilityState={{ disabled: value >= max }}
        disabled={value >= max}
        style={({ pressed }) => [
          styles.stepperButton,
          { borderColor: theme.colors.border, borderRadius: theme.radius.md },
          pressed ? styles.pressed : null,
          value >= max ? styles.disabled : null,
        ]}
        onPress={() => onChange(value + 1)}
      >
        <Text style={[styles.stepperSymbol, { color: theme.colors.text }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function StoreMessage({ message, error = false }: { message: string; error?: boolean }) {
  const { theme } = useTheme();
  return (
    <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.message, { color: error ? theme.colors.danger : theme.colors.mutedText }]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.48,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
  },
  stepperButton: {
    width: 64,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    fontSize: 32,
    lineHeight: 37,
  },
  stepperValue: {
    minWidth: 90,
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  stepperLabel: {
    fontSize: 14,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
});
