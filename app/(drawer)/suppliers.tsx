import { SupplierListScreen } from "../../src/features/suppliers/presentation/screens/SupplierListScreen";
import { OwnerOnlyRoute } from '../../src/core/auth/AuthGate';

export default function SuppliersRoute() {
  return (
    <OwnerOnlyRoute>
      <SupplierListScreen />
    </OwnerOnlyRoute>
  );
}
