import { StoreScreen } from '../../src/features/store/presentation/screens/StoreScreen';
import { OwnerOnlyRoute } from '../../src/core/auth/AuthGate';

export default function StoreRoute() {
  return (
    <OwnerOnlyRoute>
      <StoreScreen />
    </OwnerOnlyRoute>
  );
}
