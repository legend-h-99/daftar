import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller';
import { CleanArchModule } from '../infrastructure/clean-arch.module';

@Module({
  imports: [CleanArchModule],
  controllers: [MaterialsController],
})
export class MaterialsModule {}
