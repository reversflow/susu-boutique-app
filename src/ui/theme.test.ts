import { describe, expect, it } from 'vitest';
import { normalizeThemePreference, resolveTheme } from './theme';

describe('theme helpers', () => {
  it('normalizes unknown or empty preferences to light', () => {
    expect(normalizeThemePreference(null)).toBe('light');
    expect(normalizeThemePreference(undefined)).toBe('light');
    expect(normalizeThemePreference('')).toBe('light');
    expect(normalizeThemePreference('system')).toBe('light');
  });

  it('preserves dark preference explicitly', () => {
    expect(normalizeThemePreference('dark')).toBe('dark');
  });

  it('resolves light and dark palettes deterministically', () => {
    const light = resolveTheme('light');
    const dark = resolveTheme('dark');

    expect(light.isDark).toBe(false);
    expect(dark.isDark).toBe(true);
    expect(light.colors.background).toBe('#F3F4EF');
    expect(light.colors.text).toBe('#233B32');
    expect(light.colors.mutedText).toBe('#596B62');
    expect(light.colors.border).toBe('#D9E1D9');
    expect(light.colors.card).toBe('#E6EDE6');
    expect(light.colors.primary).toBe('#285744');
    expect(light.colors.onPrimary).toBe('#FFFFFF');
    expect(dark.colors.background).toBe('#19221E');
    expect(dark.colors.text).toBe('#F0F5EF');
    expect(dark.colors.mutedText).toBe('#BBCAC0');
    expect(dark.colors.border).toBe('#46594D');
    expect(dark.colors.card).toBe('#35463B');
    expect(dark.colors.primary).toBe('#B9DCC1');
    expect(dark.colors.onPrimary).toBe('#183323');
    expect(light.spacing.md).toBe(16);
    expect(light.spacing.compact).toBe(12);
    expect(dark.radius.md).toBe(10);
    expect(light.typography.serifFamily).toBeTruthy();
  });

  it('exposes a subtle accent today-cell highlight in both themes', () => {
    const light = resolveTheme('light');
    const dark = resolveTheme('dark');

    expect(light.colors.calendarHighlight).toBe('rgba(133,73,47,0.18)');
    expect(dark.colors.calendarHighlight).toBe('rgba(233,184,150,0.2)');
  });
});
