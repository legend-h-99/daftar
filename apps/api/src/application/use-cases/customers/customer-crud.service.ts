import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CUSTOMER_REPOSITORY, ICustomerRepository } from '../../ports/repositories/customer.repository.port';
import { Customer } from '../../../domain/entities/customer.entity';

@Injectable()
export class CustomerCrudService {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly repo: ICustomerRepository,
  ) {}

  create(businessId: string, dto: { name: string; phone?: string | null }): Promise<Customer> {
    return this.repo.create({ businessId, name: dto.name, phone: dto.phone });
  }

  findAll(businessId: string, limit: number, skip: number): Promise<Customer[]> {
    return this.repo.findAll(businessId, limit, skip);
  }

  async update(businessId: string, id: string, dto: { name?: string; phone?: string | null }): Promise<Customer> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Customer not found');
    return this.repo.update(id, dto);
  }

  async remove(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Customer not found');
    await this.repo.remove(id);
    return { deleted: true };
  }
}
