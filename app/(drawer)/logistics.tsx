import { LogisticsScreen } from '../../src/features/store/presentation/screens/LogisticsScreen';
import { OwnerOnlyRoute } from '../../src/core/auth/AuthGate';

export default function LogisticsRoute() {
  return (
    <OwnerOnlyRoute>
      <LogisticsScreen />
    </OwnerOnlyRoute>
  );
}
