import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

/**
 * Motion tokens shared by every animation in the app.
 *
 * Kept deliberately small: a fade + short rise for content entering the
 * screen, a spring for press feedback and a crossfade for tab changes.
 */
export const motion = {
  duration: {
    fast: 140,
    base: 260,
    slow: 380,
  },
  /** Vertical travel, in dp, for entrance animations. */
  rise: 10,
  /** Delay between sibling sections that enter one after another. */
  stagger: 45,
  /** Scale applied while a button is pressed. */
  pressedScale: 0.97,
  easing: Easing.out(Easing.cubic),
  /** Native driver is not supported by react-native-web. */
  useNativeDriver: Platform.OS !== 'web',
} as const;

export function staggerDelay(index: number, step: number = motion.stagger): number {
  return index * step;
}

/**
 * Tracks the OS "reduce motion" setting so entrance animations can be skipped
 * for people who ask for less movement. Defaults to `false` when the platform
 * does not expose the setting.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) {
          setReduced(value);
        }
      })
      .catch(() => {
        // Setting not available on this platform: keep animations enabled.
      });

    if (typeof AccessibilityInfo.addEventListener === 'function') {
      const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
      return () => {
        active = false;
        subscription.remove();
      };
    }

    return () => {
      active = false;
    };
  }, []);

  return reduced;
}
