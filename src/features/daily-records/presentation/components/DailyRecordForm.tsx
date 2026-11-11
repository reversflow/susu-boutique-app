import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ReactNode } from 'react';
import { formatCurrency } from '../../../../core/utils/currency';
import { useTheme } from '../../../../core/theme/ThemeProvider';
import { Toast } from '../../../../ui/components/Toast';
import { LedgerRow } from '../../../../ui/components/LedgerRow';
import { PrimaryButton } from '../../../../ui/components/PrimaryButton';

interface Props {
  date: string;
  totalSold: string;
  additionalExpenses: string;
  profitPercent: string;
  notes: string;
  dataphoneSales: string;
  grossProfit: number;
  netProfit: number;
  investment: number;
  saving: boolean;
  error?: string | null;
  notice?: string | null;
  onTotalSoldChange: (value: string) => void;
  onAdditionalExpensesChange: (value: string) => void;
  onProfitPercentChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onDataphoneSalesChange: (value: string) => void;
  onNoticeHide: () => void;
  onSave: () => void;
}

export function DailyRecordForm(props: Props) {
  const { theme } = useTheme();
  const dateLabel = new Date(`${props.date}T00:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const inputStyle = {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.inputBackground,
  };

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.date,
          { color: theme.colors.text, fontFamily: theme.typography.serifFamily },
        ]}
      >
        {dateLabel}
      </Text>

      <Field label="Total vendido (€)" labelId="total-sold-label">
        <TextInput
          accessibilityLabelledBy="total-sold-label"
          accessibilityLabel="Total vendido en euros"
          accessibilityHint="Ingresá el total vendido del día"
          keyboardType="decimal-pad"
          value={props.totalSold}
          onChangeText={props.onTotalSoldChange}
          placeholder="0"
          placeholderTextColor={theme.colors.mutedText}
          selectionColor={theme.colors.primary}
          style={[styles.input, inputStyle]}
        />
      </Field>

      <Field label="Ventas datafono (€)" labelId="dataphone-sales-label">
        <TextInput
          accessibilityLabelledBy="dataphone-sales-label"
          accessibilityLabel="Ventas datafono en euros"
          accessibilityHint="Ingresá cuánto se vendió con el datafono. Solo es un registro informativo, no afecta los cálculos"
          keyboardType="decimal-pad"
          value={props.dataphoneSales}
          onChangeText={props.onDataphoneSalesChange}
          placeholder="0"
          placeholderTextColor={theme.colors.mutedText}
          selectionColor={theme.colors.primary}
          style={[styles.input, inputStyle]}
        />
        <Text style={[styles.fieldHint, { color: theme.colors.mutedText }]}>
          Solo registro informativo; no se suma de nuevo a las ventas.
        </Text>
      </Field>

      <Field label="Porcentaje de beneficio (%)" labelId="profit-percent-label">
        <TextInput
          accessibilityLabelledBy="profit-percent-label"
          accessibilityLabel="Porcentaje de beneficio en tanto por ciento"
          accessibilityHint="Porcentaje sobre las ventas que se destina a beneficio"
          keyboardType="decimal-pad"
          value={props.profitPercent}
          onChangeText={props.onProfitPercentChange}
          placeholder="30"
          placeholderTextColor={theme.colors.mutedText}
          selectionColor={theme.colors.primary}
          style={[styles.input, inputStyle]}
        />
      </Field>

      <Field label="Destinar a inversión (€)" labelId="investment-cost-label">
        <Text
          nativeID="investment-cost-label"
          style={[styles.computedValue, inputStyle]}
        >
          {formatCurrency(props.investment)}
        </Text>
      </Field>

      <Field label="Gastos adicionales (€)" labelId="additional-expenses-label">
        <TextInput
          accessibilityLabelledBy="additional-expenses-label"
          accessibilityLabel="Gastos adicionales en euros"
          accessibilityHint="Ingresá los gastos adicionales del día"
          keyboardType="decimal-pad"
          value={props.additionalExpenses}
          onChangeText={props.onAdditionalExpensesChange}
          placeholder="0"
          placeholderTextColor={theme.colors.mutedText}
          selectionColor={theme.colors.primary}
          style={[styles.input, inputStyle]}
        />
      </Field>

      <Field label="Notas" labelId="notes-label">
        <TextInput
          accessibilityLabelledBy="notes-label"
          accessibilityLabel="Notas del día"
          accessibilityHint="Agregá observaciones opcionales del día"
          style={[styles.input, styles.notes, inputStyle]}
          multiline
          value={props.notes}
          onChangeText={props.onNotesChange}
          placeholder="Observaciones del día"
          placeholderTextColor={theme.colors.mutedText}
          selectionColor={theme.colors.primary}
        />
      </Field>

      <View style={styles.calculations}>
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.colors.text, fontFamily: theme.typography.serifFamily },
          ]}
        >
          Vista previa
        </Text>
        <LedgerRow label="Beneficio bruto" value={formatCurrency(props.grossProfit)} />
        <LedgerRow
          label={props.netProfit < 0 ? 'Pérdida neta' : 'Beneficio neto'}
          value={formatCurrency(props.netProfit)}
          valueColor={props.netProfit < 0 ? theme.colors.danger : theme.colors.text}
        />
      </View>

      {props.error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: theme.colors.danger }]}
        >
          {props.error}
        </Text>
      ) : null}

      <View style={styles.saveArea}>
        {props.notice ? (
          <View style={styles.toastOverlay}>
            <Toast message={props.notice} onHide={props.onNoticeHide} />
          </View>
        ) : null}
        <PrimaryButton
          accessibilityLabel="Guardar registro del día"
          title={props.saving ? 'Guardando...' : 'Guardar día'}
          busy={props.saving}
          onPress={props.onSave}
        />
      </View>
    </View>
  );
}

function Field({ label, labelId, children }: { label: string; labelId: string; children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <View style={styles.field}>
      <Text nativeID={labelId} style={[styles.fieldLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  date: {
    fontSize: 24,
    lineHeight: 32,
    textTransform: 'capitalize',
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    paddingVertical: 10,
    fontSize: 17,
  },
  computedValue: {
    minHeight: 48,
    borderWidth: 1,
    paddingVertical: 12,
    fontSize: 17,
  },
  notes: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  calculations: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
  },
  saveArea: {
    position: 'relative',
    marginTop: 4,
  },
  toastOverlay: {
    position: 'absolute',
    top: -52,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  error: {
    fontSize: 15,
  },
});
