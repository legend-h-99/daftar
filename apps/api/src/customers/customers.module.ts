import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [CustomersController],
})
export class CustomersModule {}
