import {
  CreateMovementData,
  StockMovement,
} from '../../../domain/entities/stock-movement.entity';

export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');

export interface StockMovementWithMaterial extends StockMovement {
  material: { name: string; unit: string };
}

export interface IStockMovementRepository {
  create(data: CreateMovementData): Promise<StockMovement>;
  findByBusiness(businessId: string, materialId?: string): Promise<StockMovementWithMaterial[]>;
}
