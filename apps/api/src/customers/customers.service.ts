import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationParams } from '../common/dto/pagination.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(businessId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: { businessId, name: dto.name, phone: dto.phone },
    });
  }

  findAll(businessId: string, pagination: PaginationParams) {
    return this.prisma.customer.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: pagination.limit,
      skip: pagination.skip,
    });
  }

  async findOne(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, businessId } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    const existing = await this.findOne(businessId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        phone: dto.phone ?? existing.phone,
      },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    await this.prisma.customer.delete({ where: { id } });
    return { deleted: true };
  }
}
