import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SUPPLIER_REPOSITORY, ISupplierRepository } from '../../ports/repositories/supplier.repository.port';
import { Supplier } from '../../../domain/entities/supplier.entity';

@Injectable()
export class SupplierCrudService {
  constructor(
    @Inject(SUPPLIER_REPOSITORY) private readonly repo: ISupplierRepository,
  ) {}

  create(businessId: string, dto: { name: string; phone?: string | null }): Promise<Supplier> {
    return this.repo.create({ businessId, name: dto.name, phone: dto.phone });
  }

  findAll(businessId: string, limit: number, skip: number): Promise<Supplier[]> {
    return this.repo.findAll(businessId, limit, skip);
  }

  async update(businessId: string, id: string, dto: { name?: string; phone?: string | null }): Promise<Supplier> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Supplier not found');
    return this.repo.update(id, dto);
  }

  async remove(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repo.findById(businessId, id);
    if (!existing) throw new NotFoundException('Supplier not found');
    await this.repo.remove(id);
    return { deleted: true };
  }
}
