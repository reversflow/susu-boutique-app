import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../../ui/components/Screen';
import { PrimaryButton } from '../../../../ui/components/PrimaryButton';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { useSuppliers } from '../hooks/useSuppliers';
import { Supplier } from '../../domain/types';

function formatCreated(date: string): string {
  return `Alta: ${date}`;
}

function SupplierRow({ supplier, onPress }: { supplier: Supplier; onPress: () => void }) {
  const { theme } = useTheme();
  const details = [supplier.phone, supplier.notes, formatCreated(supplier.createdAt)]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Proveedor ${supplier.name}${details ? `, ${details}` : ''}`}
      accessibilityHint="Abre el detalle para editar o eliminar"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.colors.border },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{supplier.name}</Text>
        {supplier.phone ? (
          <Text style={[styles.details, { color: theme.colors.mutedText }]}>Tel. {supplier.phone}</Text>
        ) : null}
        {supplier.notes ? (
          <Text style={[styles.details, { color: theme.colors.mutedText }]} numberOfLines={2}>
            {supplier.notes}
          </Text>
        ) : null}
        <Text style={[styles.created, { color: theme.colors.mutedText }]}>
          {formatCreated(supplier.createdAt)}
        </Text>
      </View>
      <Text accessibilityElementsHidden style={[styles.chevron, { color: theme.colors.mutedText }]}>›</Text>
    </Pressable>
  );
}

export function SupplierListScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { loading, suppliers, error, refresh } = useSuppliers();

  return (
    <Screen topInset bottomInset={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.serifFamily }]}>Proveedores</Text>
        <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>Agenda de los proveedores habituales</Text>
        <PrimaryButton title="Agregar proveedor" onPress={() => router.push('/supplier/new')} />
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.stateText, { color: theme.colors.mutedText }]}>Cargando proveedores...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar proveedores"
            onPress={() => void refresh()}
            style={styles.retry}
          >
            <Text style={[styles.retryText, { color: theme.colors.primary }]}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && suppliers.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.mutedText }]}>No hay proveedores aún. Agrega el primero.</Text>
      ) : null}

      <View>
        {suppliers.map((supplier) => (
          <SupplierRow
            key={supplier.id}
            supplier={supplier}
            onPress={() => router.push(`/supplier/${supplier.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  title: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
  },
  row: {
    minHeight: 56,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  details: {
    fontSize: 14,
  },
  created: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 24,
  },
  pressed: {
    opacity: 0.68,
  },
  state: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    fontSize: 14,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 24,
    fontSize: 15,
    textAlign: 'center',
  },
});
