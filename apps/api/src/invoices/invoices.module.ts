import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
