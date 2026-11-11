import { useCallback, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';
import { motion } from '../motion';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  accessibilityLabel?: string;
  busy?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  accessibilityLabel,
  busy = false,
  disabled = false,
}: PrimaryButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || busy;
  const scale = useRef(new Animated.Value(1)).current;

  const animateScale = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        toValue,
        speed: 40,
        bounciness: 5,
        useNativeDriver: motion.useNativeDriver,
      }).start();
    },
    [scale],
  );

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: isDisabled, busy }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => animateScale(motion.pressedScale)}
        onPressOut={() => animateScale(1)}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.sm,
          },
          pressed ? styles.pressed : null,
          isDisabled ? styles.disabled : null,
        ]}
      >
        {busy ? <ActivityIndicator color={theme.colors.onPrimary} /> : null}
        <Text style={[styles.label, { color: theme.colors.onPrimary }]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.6,
  },
});
