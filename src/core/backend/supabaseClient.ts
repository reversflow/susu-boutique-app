import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { getSupabaseConfiguration } from './config';

let client: SupabaseClient | null = null;

function getWebStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return getWebStorage()?.getItem(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      const storage = getWebStorage();
      if (!storage) throw new Error('El almacenamiento local no está disponible.');
      storage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      getWebStorage()?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfiguration() !== null;
}

export function getSupabaseClient(): SupabaseClient {
  const configuration = getSupabaseConfiguration();
  if (!configuration) {
    throw new Error('Supabase no está configurado.');
  }

  if (!client) {
    client = createClient(configuration.url, configuration.publishableKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  return client;
}
