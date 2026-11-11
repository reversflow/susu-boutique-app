import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../ui/components/Screen';
import { PrimaryButton } from '../../../../ui/components/PrimaryButton';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { useSupplierForm } from '../hooks/useSupplierForm';

function FormField(props: {
  label: string;
  labelId: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.field}>
      <Text nativeID={props.labelId} style={[styles.fieldLabel, { color: theme.colors.text }]}>
        {props.label}
      </Text>
      <TextInput
        accessibilityLabelledBy={props.labelId}
        accessibilityLabel={props.label}
        keyboardType={props.keyboardType ?? 'default'}
        multiline={props.multiline}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.colors.mutedText}
        selectionColor={theme.colors.primary}
        style={[
          styles.input,
          props.multiline ? styles.inputMultiline : null,
          {
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing.sm,
            color: theme.colors.text,
            backgroundColor: theme.colors.inputBackground,
          },
        ]}
      />
    </View>
  );
}

export function SupplierFormScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { values, loading, saving, error, isEditing, setName, setPhone, setNotes, save } =
    useSupplierForm(editingId, () => {
      router.back();
    });

  const handleSave = () => {
    void save();
  };

  if (loading) {
    return (
      <Screen keyboardAware>
        <View style={styles.center}>
          <Text style={[styles.muted, { color: theme.colors.mutedText }]}>Cargando proveedor...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen keyboardAware>
      <View style={styles.form}>

        <FormField
          label="Nombre *"
          labelId="supplier-name-label"
          value={values.name}
          onChangeText={setName}
          placeholder="Nombre del proveedor"
        />

        <FormField
          label="Teléfono"
          labelId="supplier-phone-label"
          value={values.phone}
          onChangeText={setPhone}
          placeholder="Número de teléfono"
          keyboardType="phone-pad"
        />

        <FormField
          label="Notas"
          labelId="supplier-notes-label"
          value={values.notes}
          onChangeText={setNotes}
          placeholder="Observaciones (opcional)"
          multiline
        />

        {error ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.error, { color: theme.colors.danger }]}
          >
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          title={isEditing ? 'Guardar cambios' : 'Crear proveedor'}
          accessibilityLabel={isEditing ? 'Guardar cambios del proveedor' : 'Crear proveedor'}
          busy={saving}
          onPress={handleSave}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  muted: {
    fontSize: 15,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    paddingVertical: 10,
    fontSize: 17,
  },
  inputMultiline: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 14,
  },
});
