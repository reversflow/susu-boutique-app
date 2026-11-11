import { useState } from 'react';
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
import { formatCurrency } from '../../../../../core/utils/currency';
import { toIsoDate } from '../../../../../core/utils/date';
import { useTheme } from '../../../../../core/theme/ThemeProvider';
import { LedgerRow } from '../../../../../ui/components/LedgerRow';
import { parseManualCapitalAddition } from './manualAdjustmentAmount';
import {
  InvestmentPurchaseButton,
  InvestmentPurchaseModal,
} from './InvestmentPurchaseModal';

interface Props {
  available: number;
  adjustmentsTotal: number;
  investedTotal: number;
  purchasesTotal: number;
  loading: boolean;
  adding: boolean;
  error: string | null;
  actionError?: string | null;
  onAddAdjustment: (input: { date: string; amount: number; note: string }) => Promise<boolean>;
  onAddPurchase: (input: {
    date: string;
    amount: number;
    note: string;
    supplierId?: number | null;
  }) => Promise<boolean>;
  onRefresh: () => void;
}

export function InvestmentBalanceCard({
  available,
  adjustmentsTotal,
  investedTotal,
  purchasesTotal,
  loading,
  adding,
  error,
  actionError,
  onAddAdjustment,
  onAddPurchase,
  onRefresh,
}: Props) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [purchaseVisible, setPurchaseVisible] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(() => toIsoDate(new Date()));
  const [adjustmentDate, setAdjustmentDate] = useState(() => toIsoDate(new Date()));

  const handlePurchaseSubmit = async (input: {
    date: string;
    amount: string;
    note: string;
    supplierId: number | null;
  }) => {
    const parsed = Number(input.amount) || 0;
    return onAddPurchase({
      date: input.date,
      amount: parsed,
      note: input.note,
      supplierId: input.supplierId,
    });
  };

  const openModal = () => {
    setAmount('');
    setNote('');
    setValidationError(null);
    setAdjustmentDate(toIsoDate(new Date()));
    setModalVisible(true);
  };

  const openPurchase = () => {
    setPurchaseDate(toIsoDate(new Date()));
    setPurchaseVisible(true);
  };

  const handleSave = async () => {
    const parsed = parseManualCapitalAddition(amount);
    if (parsed === null) {
      setValidationError('Introduce un importe mayor que cero para agregar capital.');
      return;
    }

    const ok = await onAddAdjustment({
      date: adjustmentDate,
      amount: Math.abs(parsed),
      note: note.trim(),
    });

    if (ok) {
      setModalVisible(false);
    }
  };

  const formattedAvailable = error
    ? 'No disponible'
    : loading
      ? '…'
      : formatCurrency(available);
  const availableValueColor = error || loading
    ? theme.colors.mutedText
    : available < 0
      ? theme.colors.danger
      : theme.colors.investment;
  const formattedBreakdown = (value: number) =>
    error ? 'No disponible' : loading ? '…' : formatCurrency(value);

  return (
      <View style={styles.card}>
      <Text style={[styles.availableLabel, { color: theme.colors.mutedText }]}>Disponible</Text>
      <Text
        accessibilityLabel={`Capital disponible, ${formattedAvailable}`}
        style={[styles.value, { color: availableValueColor, fontFamily: theme.typography.serifFamily }]}
      >
        {formattedAvailable}
      </Text>

      <View style={styles.breakdown}>
        <LedgerRow label="Destinado desde las entradas" value={formattedBreakdown(investedTotal)} />
        <LedgerRow label="Ajustes manuales" value={formattedBreakdown(adjustmentsTotal)} />
        <LedgerRow label="Compras a proveedores" value={formattedBreakdown(-purchasesTotal)} />
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.error, { color: theme.colors.danger }]}
          >
            {error}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar capital" onPress={onRefresh} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: theme.colors.primary }]}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
      {actionError ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
          {actionError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustar capital hoy"
          style={({ pressed }) => [
            styles.button,
            {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.sm,
            },
            pressed ? styles.buttonPressed : null,
          ]}
          onPress={openModal}
        >
          <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Ajustar hoy</Text>
        </Pressable>
        <InvestmentPurchaseButton
          adding={adding}
          onPress={openPurchase}
        />
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
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
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Ajustar capital hoy</Text>
            <Text style={[styles.modalHint, { color: theme.colors.mutedText }]}>
              {`Fecha del movimiento: ${new Date(`${adjustmentDate}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </Text>

            <TextInput
              accessibilityLabel="Monto del ajuste en euros"
              accessibilityHint="Monto a agregar al capital"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(value) => {
                setAmount(value);
                setValidationError(null);
              }}
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
            {validationError ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger }]}>
                {validationError}
              </Text>
            ) : null}
            <TextInput
              accessibilityLabel="Nota del ajuste"
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

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar ajuste"
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                  },
                  pressed ? styles.buttonPressed : null,
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar ajuste"
                accessibilityState={{ disabled: adding }}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radius.md,
                  },
                  pressed || adding ? styles.buttonPressed : null,
                ]}
                disabled={adding}
                onPress={() => void handleSave()}
              >
      <Text style={[styles.modalButtonTextPrimary, { color: theme.colors.onPrimary }]}>
                  {adding ? 'Guardando...' : 'Guardar'}
                </Text>
              </Pressable>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <InvestmentPurchaseModal
        visible={purchaseVisible}
        saving={adding}
        defaultDate={purchaseDate}
        title="Agregar inversión hoy"
        onClose={() => setPurchaseVisible(false)}
        onSubmit={handlePurchaseSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
  },
  availableLabel: {
    fontSize: 14,
  },
  value: {
    fontSize: 36,
    lineHeight: 45,
  },
  breakdown: {
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
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
  buttonPressed: {
    opacity: 0.65,
  },
  error: {
    fontSize: 14,
    flex: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  modalHint: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  input: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 17,
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
  modalButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  modalButtonTextPrimary: {
    fontWeight: '700',
    fontSize: 15,
  },
});
