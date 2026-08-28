import {
  CreatePurchaseData,
  CreatePurchaseItemData,
  Purchase,
  PurchaseWithItems,
} from '../../../domain/entities/purchase.entity';

export const PURCHASE_REPOSITORY = Symbol('PURCHASE_REPOSITORY');

export interface IPurchaseRepository {
  findById(businessId: string, id: string): Promise<PurchaseWithItems | null>;
  findAll(businessId: string, supplierId?: string, month?: string): Promise<PurchaseWithItems[]>;
  maxNumber(businessId: string): Promise<number>;
  create(data: CreatePurchaseData): Promise<Purchase>;
  createItem(data: CreatePurchaseItemData): Promise<void>;
  remove(id: string): Promise<PurchaseWithItems>;
}
