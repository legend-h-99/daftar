import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [InventoryController],
})
export class InventoryModule {}
