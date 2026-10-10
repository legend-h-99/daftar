import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [PurchasesController],
})
export class PurchasesModule {}
