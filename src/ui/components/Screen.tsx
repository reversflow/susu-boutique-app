import { PropsWithChildren, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  PixelRatio,
  Platform,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import { useTheme } from '../../core/theme/ThemeProvider';
import { motion, useReducedMotion } from '../motion';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
  topInset?: boolean;
  bottomInset?: boolean;
  keyboardAware?: boolean;
  /** Fade the screen in when it mounts. Disable for nested or instant screens. */
  animated?: boolean;
}>;

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  topInset = false,
  bottomInset = true,
  keyboardAware = false,
  animated = true,
}: ScreenProps) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated || reducedMotion) {
      entrance.setValue(1);
      return;
    }

    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: motion.duration.base,
      easing: motion.easing,
      useNativeDriver: motion.useNativeDriver,
    });

    animation.start();

    return () => animation.stop();
  }, [animated, entrance, reducedMotion]);

  const entranceStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [motion.rise, 0],
        }),
      },
    ],
  };
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  // Native-stack reports the Android header origin in px; KeyboardAvoidingView expects dp.
  const keyboardVerticalOffset =
    Platform.OS === 'android' ? headerHeight / PixelRatio.get() : headerHeight;
  const { width } = useWindowDimensions();
  const safeAreaEdges: Edge[] = [
    ...(topInset ? ['top' as const] : []),
    'left',
    'right',
    ...(bottomInset ? ['bottom' as const] : []),
  ];
  const horizontalPadding = Math.min(
    theme.spacing.lg,
    Math.max(theme.spacing.md, width * 0.06),
  );
  const contentStyle = [
    styles.container,
    {
      paddingHorizontal: horizontalPadding,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.md,
    },
    contentContainerStyle,
  ];

  if (scroll) {
    return (
      <SafeAreaView
        edges={safeAreaEdges}
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      >
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={keyboardAware ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          <Animated.ScrollView
            style={[styles.fill, entranceStyle]}
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboardAware ? 'none' : 'on-drag'}
          >
            {children}
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={keyboardAware ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <Animated.View style={[contentStyle, entranceStyle]}>{children}</Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  container: {},
});
