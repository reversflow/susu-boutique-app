import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '../src/core/providers/AppProviders';
import { createRootStackScreenOptions } from '../src/core/navigation/rootStackScreenOptions';
import { rootStackRoutes } from '../src/core/navigation/rootStackRoutes';
import { useTheme } from '../src/core/theme/ThemeProvider';
import { SignOutButton } from '../src/core/navigation/SignOutButton';

function RootNavigationLayout() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          ...createRootStackScreenOptions(theme),
          headerRight: () => <SignOutButton />,
        }}
      >
        {rootStackRoutes.map((route) => (
          <Stack.Screen key={route.name} name={route.name} options={route.options} />
        ))}
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigationLayout />
    </AppProviders>
  );
}
