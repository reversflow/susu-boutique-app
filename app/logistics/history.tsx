import { MovementHistoryScreen } from '../../src/features/store/presentation/screens/MovementHistoryScreen';
import { OwnerOnlyRoute } from '../../src/core/auth/AuthGate';

export default function LogisticsHistoryRoute() {
  return (
    <OwnerOnlyRoute>
      <MovementHistoryScreen />
    </OwnerOnlyRoute>
  );
}
