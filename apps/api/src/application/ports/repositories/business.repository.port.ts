import { Business } from '../../../domain/entities/business.entity';

export const BUSINESS_REPOSITORY = Symbol('BUSINESS_REPOSITORY');

export interface IBusinessRepository {
  findById(id: string): Promise<Business | null>;
}
