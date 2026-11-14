import { DailyRecordService } from '../application/DailyRecordService';
import { SupabaseDailyRecordRepository } from './SupabaseDailyRecordRepository';
import { InvestmentBalanceService } from '../investment/application/InvestmentBalanceService';
import { SupabaseInvestmentAdjustmentRepository } from '../investment/infrastructure/SupabaseInvestmentAdjustmentRepository';
import { BackupService, createBackupService } from '../../../core/storage/backup';

const repository = new SupabaseDailyRecordRepository();
const adjustmentRepository = new SupabaseInvestmentAdjustmentRepository();

export const dailyRecordService = new DailyRecordService(repository);
export const investmentBalanceService = new InvestmentBalanceService(
  adjustmentRepository,
  repository
);
export const backupService: BackupService = createBackupService();
