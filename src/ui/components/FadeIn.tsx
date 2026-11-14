import { PropsWithChildren, useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { motion, useReducedMotion } from '../motion';

type FadeInProps = PropsWithChildren<{
  /** Delay before the animation starts, in milliseconds. */
  delay?: number;
  duration?: number;
  /** Vertical offset, in dp, that the content travels while fading in. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Fades and lifts its content into place once, when it mounts.
 *
 * Used for cards and screen sections so lists feel alive without moving
 * anything the user is already reading.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = motion.duration.base,
  offset = motion.rise,
  style,
}: FadeInProps) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: motion.easing,
      useNativeDriver: motion.useNativeDriver,
    });

    animation.start();

    return () => animation.stop();
  }, [delay, duration, progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
