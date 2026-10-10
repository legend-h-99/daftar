import { Supplier, CreateSupplierData, UpdateSupplierData } from '../../../domain/entities/supplier.entity';

export const SUPPLIER_REPOSITORY = Symbol('SUPPLIER_REPOSITORY');

export interface ISupplierRepository {
  findById(businessId: string, id: string): Promise<Supplier | null>;
  findByName(businessId: string, name: string): Promise<Supplier | null>;
  findAll(businessId: string, limit: number, skip: number): Promise<Supplier[]>;
  create(data: CreateSupplierData): Promise<Supplier>;
  update(id: string, data: UpdateSupplierData): Promise<Supplier>;
  remove(id: string): Promise<void>;
}
