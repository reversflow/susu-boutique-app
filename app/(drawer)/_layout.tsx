import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBusinessRole } from '../../src/core/auth/AuthGate';
import { canAccessOwnerSections } from '../../src/core/auth/businessRole';
import { useTheme } from '../../src/core/theme/ThemeProvider';
import { SignOutButton } from '../../src/core/navigation/SignOutButton';

export default function AppTabsLayout() {
  const { theme } = useTheme();
  const businessRole = useBusinessRole();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 768;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ paddingTop: insets.top + 16, paddingBottom: 16, paddingHorizontal: desktop ? 32 : 20, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <Text accessibilityRole="header" style={{ color: theme.colors.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.5, flexShrink: 1 }}>Susu's Boutique</Text>
        <SignOutButton />
      </View>
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedText,
        tabBarHideOnKeyboard: true,
        tabBarPosition: desktop ? 'top' : 'bottom',
        tabBarStyle: {
          height: desktop ? 54 : 60 + insets.bottom,
          paddingTop: 4,
          paddingBottom: desktop ? 4 : Math.max(4, insets.bottom),
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: desktop ? 0 : 1,
          borderBottomColor: theme.colors.border,
          borderBottomWidth: desktop ? 1 : 0,
        },
        tabBarItemStyle: desktop ? { maxWidth: 150 } : undefined,
        tabBarLabelStyle: {
          fontSize: 12,
          lineHeight: 15,
        },
      }}
    >
      <Tabs.Screen
        name="store"
        options={{
          title: 'Tienda',
          href: canAccessOwnerSections(businessRole) ? undefined : null,
          tabBarIcon: ({ color, size }) => <Feather name="grid" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vender',
          tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="logistics"
        options={{
          title: 'Logística',
          href: canAccessOwnerSections(businessRole) ? undefined : null,
          tabBarIcon: ({ color, size }) => <Feather name="truck" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="suppliers" options={{ href: null }} />
    </Tabs>
    </View>
  );
}
