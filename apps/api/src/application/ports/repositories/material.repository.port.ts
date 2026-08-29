import {
  CreateMaterialData,
  Material,
  MaterialUnit,
  UpdateMaterialPricingData,
} from '../../../domain/entities/material.entity';

export const MATERIAL_REPOSITORY = Symbol('MATERIAL_REPOSITORY');

export interface IMaterialRepository {
  findById(businessId: string, id: string): Promise<Material | null>;
  findByNameAndUnit(businessId: string, name: string, unit: MaterialUnit): Promise<Material | null>;
  findAllByBusiness(businessId: string): Promise<Material[]>;
  findManyByIds(ids: string[]): Promise<Material[]>;
  create(data: CreateMaterialData): Promise<Material>;
  update(id: string, data: Partial<Material>): Promise<Material>;
  incrementStock(id: string, qty: number): Promise<Material>;
  decrementStock(id: string, qty: number): Promise<Material>;
  setStock(id: string, qty: number): Promise<Material>;
  updatePricing(id: string, data: UpdateMaterialPricingData): Promise<Material>;
}
