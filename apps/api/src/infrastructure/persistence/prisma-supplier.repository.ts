import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ISupplierRepository } from '../../application/ports/repositories/supplier.repository.port';
import { Supplier, CreateSupplierData, UpdateSupplierData } from '../../domain/entities/supplier.entity';

const s = <T>(p: PromiseLike<T>): Promise<Supplier> => p as unknown as Promise<Supplier>;
const ss = <T>(p: PromiseLike<T>): Promise<Supplier[]> => p as unknown as Promise<Supplier[]>;

@Injectable()
export class PrismaSupplierRepository implements ISupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(businessId: string, id: string): Promise<Supplier | null> {
    const r = await this.prisma.supplier.findFirst({ where: { id, businessId } });
    return r as unknown as Supplier | null;
  }

  async findByName(businessId: string, name: string): Promise<Supplier | null> {
    const r = await this.prisma.supplier.findFirst({ where: { businessId, name } });
    return r as unknown as Supplier | null;
  }

  findAll(businessId: string, limit: number, skip: number): Promise<Supplier[]> {
    return ss(
      this.prisma.supplier.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    );
  }

  create(data: CreateSupplierData): Promise<Supplier> {
    return s(this.prisma.supplier.create({ data }));
  }

  update(id: string, data: UpdateSupplierData): Promise<Supplier> {
    return s(this.prisma.supplier.update({ where: { id }, data }));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.supplier.delete({ where: { id } });
  }
}
