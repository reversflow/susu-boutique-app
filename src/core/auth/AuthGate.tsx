import { PropsWithChildren, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../ui/components/Screen';
import { PrimaryButton } from '../../ui/components/PrimaryButton';
import { useTheme } from '../theme/ThemeProvider';
import { SUSU_BOUTIQUE_BUSINESS_ID } from '../backend/config';
import { getSupabaseClient } from '../backend/supabaseClient';
import { useAuth } from './AuthProvider';

type MembershipState = 'loading' | 'allowed' | 'missing' | 'error';

function AuthMessage({
  title,
  message,
  onRetry,
  onSignOut,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  onSignOut?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Screen topInset contentContainerStyle={styles.centerContent}>
      <View style={styles.form}>
        <Text style={[styles.brand, { color: theme.colors.text, fontFamily: theme.typography.serifFamily }]}>Susu’s Boutique</Text>
        <Text style={[styles.heading, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.colors.mutedText }]}>{message}</Text>
        {onRetry ? <PrimaryButton title="Reintentar" onPress={onRetry} /> : null}
        {onSignOut ? (
          <Pressable accessibilityRole="button" onPress={onSignOut}>
            <Text style={[styles.link, { color: theme.colors.primary }]}>Cerrar sesión</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function SignInScreen() {
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const signInError = await signIn(email.trim(), password);
    setBusy(false);
    if (signInError) {
      setError('No se pudo iniciar sesión. Revisá el correo, la contraseña y la conexión.');
    }
  };

  return (
    <Screen topInset keyboardAware contentContainerStyle={styles.centerContent}>
      <View style={styles.form}>
        <Text style={[styles.brand, { color: theme.colors.text, fontFamily: theme.typography.serifFamily }]}>Susu’s Boutique</Text>
        <Text style={[styles.heading, { color: theme.colors.text }]}>Ingresá a tu cuenta</Text>
        <Text style={[styles.description, { color: theme.colors.mutedText }]}>Usá el correo y la contraseña de tu cuenta personal.</Text>
        <TextInput
          accessibilityLabel="Correo electrónico"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          placeholder="Correo electrónico"
          placeholderTextColor={theme.colors.mutedText}
          editable={!busy}
          returnKeyType="next"
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
        />
        <TextInput
          accessibilityLabel="Contraseña"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          placeholder="Contraseña"
          placeholderTextColor={theme.colors.mutedText}
          editable={!busy}
          returnKeyType="done"
          style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
        />
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
        <PrimaryButton
          title="Iniciar sesión"
          onPress={() => void submit()}
          busy={busy}
          disabled={!email.trim() || !password}
        />
      </View>
    </Screen>
  );
}

export function AuthGate({ children }: PropsWithChildren) {
  const { isConfigured, isLoading, error, session, retry, signOut } = useAuth();
  const [membership, setMembership] = useState<MembershipState>('loading');
  const [membershipRetryKey, setMembershipRetryKey] = useState(0);

  useEffect(() => {
    if (isLoading || !session) {
      setMembership('loading');
      return;
    }

    let mounted = true;
    setMembership('loading');
    void getSupabaseClient()
      .from('business_members')
      .select('user_id')
      .eq('business_id', SUSU_BOUTIQUE_BUSINESS_ID)
      .maybeSingle()
      .then(({ data, error: membershipError }) => {
        if (!mounted) return;
        setMembership(membershipError ? 'error' : data ? 'allowed' : 'missing');
      }, () => {
        if (mounted) setMembership('error');
      });

    return () => {
      mounted = false;
    };
  }, [isLoading, membershipRetryKey, session?.user.id]);

  if (!isConfigured) {
    return (
      <AuthMessage
        title="Falta configurar la conexión"
        message="Agregá la URL del proyecto Supabase y su clave pública en las variables de entorno para habilitar el acceso."
      />
    );
  }

  if (isLoading) {
    return <AuthMessage title="Conectando…" message="Estamos recuperando tu sesión." />;
  }

  if (error) {
    return <AuthMessage title="No se pudo recuperar la sesión" message={error} onRetry={retry} />;
  }

  if (!session) {
    return <SignInScreen />;
  }

  if (membership === 'loading') {
    return <AuthMessage title="Verificando acceso…" message="Estamos comprobando tu cuenta." />;
  }

  if (membership === 'error') {
    return (
      <AuthMessage
        title="No se pudo verificar el acceso"
        message="Revisá tu conexión e intentá de nuevo."
        onRetry={() => setMembershipRetryKey((current) => current + 1)}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (membership === 'missing') {
    return (
      <AuthMessage
        title="Cuenta sin acceso"
        message="Esta cuenta todavía no está habilitada para Susu’s Boutique. Contactá a quien administra el acceso."
        onSignOut={() => void signOut()}
      />
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 14,
  },
  brand: {
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  error: {
    fontSize: 14,
  },
  link: {
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});
