import { Alert, Platform } from 'react-native';

const confirmationTitle = '¿Cerrar sesión?';
const confirmationMessage = 'Se perderán los cambios que no hayas guardado.';
const failureTitle = 'No se pudo cerrar sesión';
const failureMessage = 'Revisa tu conexión e inténtalo de nuevo.';

export function confirmSignOut(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${confirmationTitle}\n\n${confirmationMessage}`));
  }

  return new Promise((resolve) => {
    Alert.alert(confirmationTitle, confirmationMessage, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function showSignOutFailure(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${failureTitle}. ${failureMessage}`);
  } else {
    Alert.alert(failureTitle, failureMessage);
  }
}
