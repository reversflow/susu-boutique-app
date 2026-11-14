import { SupplierFormScreen } from '../../src/features/suppliers/presentation/screens/SupplierFormScreen';
import { OwnerOnlyRoute } from '../../src/core/auth/AuthGate';

export default function EditSupplierRoute() {
  return (
    <OwnerOnlyRoute>
      <SupplierFormScreen />
    </OwnerOnlyRoute>
  );
}
