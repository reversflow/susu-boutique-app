import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!isConfigured) {
      setSession(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    let receivedAuthEvent = false;
    let client;

    try {
      client = getSupabaseClient();
    } catch {
      setIsLoading(false);
      setError('No se pudo preparar la conexión segura.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (mounted) {
        setSession(nextSession);
        setIsLoading(false);
        setError(null);
      }
    });

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted || receivedAuthEvent) return;
      if (sessionError) {
        setError('No se pudo recuperar la sesión. Revisa la conexión e inténtalo de nuevo.');
      } else {
        setSession(data.session);
      }
      setIsLoading(false);
    }).catch(() => {
      if (mounted && !receivedAuthEvent) {
        setError('No se pudo recuperar la sesión. Revisa la conexión e inténtalo de nuevo.');
        setIsLoading(false);
      }
    });

    const appStateSubscription = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void client.auth.startAutoRefresh();
          } else {
            void client.auth.stopAutoRefresh();
          }
        });

    if (Platform.OS !== 'web' && AppState.currentState === 'active') {
      void client.auth.startAutoRefresh();
    }

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== 'web') void client.auth.stopAutoRefresh();
    };
  }, [isConfigured, retryKey]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      return signInError?.message ?? null;
    } catch {
      return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
    }
  }, []);

  const signOut = useCallback(async (): Promise<string | null> => {
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      return signOutError?.message ?? null;
    } catch {
      return 'No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.';
    }
  }, []);

  const retry = useCallback(() => setRetryKey((current) => current + 1), []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isLoading,
    isConfigured,
    error,
    signIn,
    signOut,
    retry,
  }), [error, isConfigured, isLoading, retry, session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
