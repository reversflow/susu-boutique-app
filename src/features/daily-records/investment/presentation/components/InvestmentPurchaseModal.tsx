import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../../../../core/theme/ThemeProvider';
import { useSuppliers } from '../../../../suppliers/presentation/hooks/useSuppliers';
import { toIsoDate } from '../../../../../core/utils/date';

interface Props {
  visible: boolean;
  saving: boolean;
  defaultDate?: string;
  showTitle?: boolean;
  title?: string;
  onClose: () => void;
  onSubmit: (input: {
    date: string;
    amount: string;
    note: string;
    supplierId: number | null;
  }) => Promise<boolean>;
}

export function InvestmentPurchaseModal({ visible, saving, defaultDate, showTitle = true, title = 'Registrar inversión', onClose, onSubmit }: Props) {
  const { theme } = useTheme();
  const { suppliers } = useSuppliers();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setNote('');
      setSelectedSupplierId(null);
      setPickerOpen(false);
      setSubmitError(null);
    }
  }, [visible]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, suppliers]
  );
  const dateLabel = new Date(`${defaultDate ?? toIsoDate(new Date())}T00:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleSave = async () => {
    if (!selectedSupplierId) {
      setSubmitError('Seleccioná un proveedor.');
      return;
    }
    const parsed = Number(amount.replace(',', '.')) || 0;
    if (parsed <= 0) {
      setSubmitError('El monto debe ser mayor a 0.');
      return;
    }

    const ok = await onSubmit({
      date: defaultDate ?? toIsoDate(new Date()),
      amount: String(parsed),
      note: note.trim(),
      supplierId: selectedSupplierId,
    });

    if (ok) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
        >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
            },
          ]}
        >
          {showTitle ? (
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{title}</Text>
          ) : null}

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Fecha del movimiento</Text>
            <Text accessibilityLabel={`Fecha de la inversión, ${dateLabel}`} style={[styles.dateValue, { color: theme.colors.mutedText }]}>
              {dateLabel}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Proveedor *</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Seleccionar proveedor"
              accessibilityState={{ expanded: pickerOpen }}
              onPress={() => setPickerOpen((open) => !open)}
              style={[
                styles.pickerButton,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.inputBackground,
                },
              ]}
            >
              <Text
                style={[
                  styles.pickerText,
                  { color: selectedSupplier ? theme.colors.text : theme.colors.mutedText },
                ]}
              >
                {selectedSupplier ? selectedSupplier.name : 'Elegí un proveedor…'}
              </Text>
              <Text style={[styles.pickerCaret, { color: theme.colors.mutedText }]}>⌄</Text>
            </Pressable>

            {pickerOpen ? (
              <View
                style={[
                  styles.pickerList,
                  {
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                {suppliers.length === 0 ? (
                  <Text style={[styles.pickerEmpty, { color: theme.colors.mutedText }]}>
                    No hay proveedores. Agregalos desde la agenda.
                  </Text>
                ) : (
                  suppliers.map((supplier) => {
                    const isSelected = supplier.id === selectedSupplierId;
                    return (
                      <Pressable
                        key={supplier.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          setSelectedSupplierId(supplier.id);
                          setPickerOpen(false);
                        }}
                        style={({ pressed }) => [
                          styles.pickerOption,
                          {
                            backgroundColor: isSelected
                              ? theme.colors.primarySoft
                              : theme.colors.surface,
                          },
                          pressed ? styles.pickerOptionPressed : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            { color: isSelected ? theme.colors.primary : theme.colors.text },
                          ]}
                        >
                          {supplier.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Monto (€) *</Text>
            <TextInput
              accessibilityLabel="Monto de la inversión en euros"
              accessibilityHint="Ingresá cuánto invertiste con este proveedor"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={theme.colors.mutedText}
              selectionColor={theme.colors.primary}
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.inputBackground,
                },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Nota</Text>
            <TextInput
              accessibilityLabel="Nota de la inversión"
              value={note}
              onChangeText={setNote}
              placeholder="Nota (opcional)"
              placeholderTextColor={theme.colors.mutedText}
              selectionColor={theme.colors.primary}
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.inputBackground,
                },
              ]}
            />
          </View>

          {submitError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.error, { color: theme.colors.danger }]}
            >
              {submitError}
            </Text>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar inversión"
              style={({ pressed }) => [
                styles.modalButton,
                {
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                },
                pressed ? styles.buttonPressed : null,
              ]}
              onPress={onClose}
            >
              <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guardar inversión"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [
                styles.modalButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.md,
                },
                pressed || saving ? styles.buttonPressed : null,
              ]}
              disabled={saving}
              onPress={() => void handleSave()}
            >
              <Text style={[styles.modalButtonTextPrimary, { color: theme.colors.onPrimary }]}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Text>
            </Pressable>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface TriggerProps {
  adding: boolean;
  onPress: () => void;
}

export function InvestmentPurchaseButton({ adding, onPress }: TriggerProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Agregar inversión hoy"
      accessibilityHint="Abre el formulario para registrar una inversión de hoy con un proveedor"
      accessibilityState={{ disabled: adding }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.sm,
        },
        pressed ? styles.buttonPressed : null,
      ]}
      disabled={adding}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Invertir hoy</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalContent: {
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  dateValue: {
    minHeight: 40,
    paddingVertical: 10,
    fontSize: 15,
    textTransform: 'capitalize',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickerButton: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 16,
  },
  pickerCaret: {
    fontSize: 20,
  },
  pickerList: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerEmpty: {
    padding: 12,
    fontSize: 14,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  pickerOptionPressed: {
    opacity: 0.7,
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 17,
  },
  error: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    borderWidth: 1,
    minHeight: 48,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.65,
  },
  modalButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  modalButtonTextPrimary: {
    fontWeight: '700',
    fontSize: 15,
  },
  button: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
});
