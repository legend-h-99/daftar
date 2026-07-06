import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: { businessId, name: dto.name, phone: dto.phone },
    });
  }

  findAll(businessId: string) {
    return this.prisma.supplier.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    return supplier;
  }

  async update(businessId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(businessId, id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    await this.prisma.supplier.delete({ where: { id } });
    return { deleted: true };
  }
}
