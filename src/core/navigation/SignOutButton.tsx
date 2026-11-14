import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { confirmSignOut, showSignOutFailure } from '../auth/signOutConfirmation';
import { useTheme } from '../theme/ThemeProvider';

type SignOutStatus = 'idle' | 'confirming' | 'signing-out';

export function SignOutButton() {
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const [status, setStatus] = useState<SignOutStatus>('idle');
  const [focused, setFocused] = useState(false);
  const inProgress = useRef(false);
  const foreground = theme.isDark ? theme.colors.background : theme.colors.white;

  const handlePress = async () => {
    if (inProgress.current) return;
    inProgress.current = true;
    setStatus('confirming');
    try {
      const confirmed = await confirmSignOut();
      if (!confirmed) {
        inProgress.current = false;
        setStatus('idle');
        return;
      }
      setStatus('signing-out');
      const error = await signOut();
      if (error) {
        showSignOutFailure();
        inProgress.current = false;
        setStatus('idle');
      }
    } catch {
      showSignOutFailure();
      inProgress.current = false;
      setStatus('idle');
    }
  };

  const busy = status !== 'idle';
  const signingOut = status === 'signing-out';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status === 'confirming' ? 'Confirmar cierre de sesión' : signingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
      accessibilityHint="Cierra la sesión y vuelve al inicio de sesión."
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => void handlePress()}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.danger,
          borderRadius: theme.radius.sm,
          borderColor: theme.colors.background,
          borderWidth: focused ? 2 : 0,
          opacity: pressed && !busy ? 0.84 : 1,
        },
      ]}
    >
      {signingOut ? <ActivityIndicator size="small" color={foreground} /> : <Feather name="log-out" size={16} color={foreground} />}
      <Text style={[styles.label, { color: foreground }]}>{signingOut ? 'Cerrando…' : 'Cerrar sesión'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
