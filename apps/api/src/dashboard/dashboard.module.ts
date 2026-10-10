import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
