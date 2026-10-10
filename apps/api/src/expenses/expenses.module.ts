import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [ExpensesController],
})
export class ExpensesModule {}
