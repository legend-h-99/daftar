import { Customer, CreateCustomerData, UpdateCustomerData } from '../../../domain/entities/customer.entity';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface ICustomerRepository {
  findById(businessId: string, id: string): Promise<Customer | null>;
  findAll(businessId: string, limit: number, skip: number): Promise<Customer[]>;
  create(data: CreateCustomerData): Promise<Customer>;
  update(id: string, data: UpdateCustomerData): Promise<Customer>;
  remove(id: string): Promise<void>;
}
