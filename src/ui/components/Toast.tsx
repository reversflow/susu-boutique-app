import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

interface Props {
  message: string;
  onHide?: () => void;
}

const TOAST_VISIBLE_MS = 2200;

export function Toast({ message, onHide }: Props) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const appear = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]);
    const disappear = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 10, duration: 240, useNativeDriver: true }),
    ]);

    const timer = setTimeout(() => {
      disappear.start(({ finished }) => {
        if (finished) {
          onHide?.();
        }
      });
    }, TOAST_VISIBLE_MS);

    appear.start();

    return () => clearTimeout(timer);
  }, [onHide, opacity, translateY]);

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: theme.colors.success,
          borderRadius: theme.radius.md,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.message, { color: theme.colors.onPrimary }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
  },
});
