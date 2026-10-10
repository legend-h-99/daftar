import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
