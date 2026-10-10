import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [SuppliersController],
})
export class SuppliersModule {}
