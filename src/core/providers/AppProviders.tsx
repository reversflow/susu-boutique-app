import { Component, ErrorInfo, PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getDatabaseGeneration,
  initializeDatabase,
  subscribeDatabaseGeneration,
} from '../storage/sqlite';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

type AppRootErrorBoundaryState = {
  hasError: boolean;
};

class AppRootErrorBoundary extends Component<PropsWithChildren, AppRootErrorBoundaryState> {
  state: AppRootErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppRootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppRootErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Algo salió mal.</Text>
          <Text style={styles.errorDescription}>Cerrá y volvé a abrir la app para recuperar el estado.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppBootstrapProvider({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setReady(false);
      setError(null);

      try {
        await initializeDatabase();
        if (mounted) {
          setReady(true);
        }
      } catch (cause) {
        console.error('[AppBootstrapProvider] Failed to initialize database', cause);
        if (mounted) {
          setError('No se pudo inicializar la base local.');
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [retrySeed]);

  if (error) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: theme.colors.background,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Text style={[styles.errorTitle, { color: theme.colors.danger }]}>Error de inicio</Text>
        <Text style={[styles.errorDescription, { color: theme.colors.text }]}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              marginTop: theme.spacing.xs,
            },
          ]}
          onPress={() => setRetrySeed((prev) => prev + 1)}
        >
          <Text style={styles.buttonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!ready) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: theme.colors.background,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Text style={[styles.loading, { color: theme.colors.mutedText }]}>Inicializando datos...</Text>
      </View>
    );
  }

  return children;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [databaseGeneration, setDatabaseGeneration] = useState(getDatabaseGeneration);

  useEffect(
    () => subscribeDatabaseGeneration(setDatabaseGeneration),
    [],
  );

  return (
    <AppRootErrorBoundary>
      <ThemeProvider>
        <AppBootstrapProvider key={databaseGeneration}>{children}</AppBootstrapProvider>
      </ThemeProvider>
    </AppRootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5EFE6',
    padding: 16,
    gap: 10,
  },
  loading: {
    fontSize: 15,
  },
  errorTitle: {
    fontWeight: '700',
    fontSize: 20,
  },
  errorDescription: {
    textAlign: 'center',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#5B3A29',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
