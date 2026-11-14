import { Component, ErrorInfo, PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthGate } from '../auth/AuthGate';
import { AuthProvider } from '../auth/AuthProvider';
import { ThemeProvider } from '../theme/ThemeProvider';

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
          <Text style={styles.errorDescription}>Cierra y vuelve a abrir la aplicación para recuperar el estado.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppRootErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </AuthProvider>
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
