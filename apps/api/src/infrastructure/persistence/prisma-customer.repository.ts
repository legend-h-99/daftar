import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ICustomerRepository } from '../../application/ports/repositories/customer.repository.port';
import { Customer, CreateCustomerData, UpdateCustomerData } from '../../domain/entities/customer.entity';

const c = <T>(p: PromiseLike<T>): Promise<Customer> => p as unknown as Promise<Customer>;
const cs = <T>(p: PromiseLike<T>): Promise<Customer[]> => p as unknown as Promise<Customer[]>;

@Injectable()
export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(businessId: string, id: string): Promise<Customer | null> {
    const r = await this.prisma.customer.findFirst({ where: { id, businessId } });
    return r as unknown as Customer | null;
  }

  findAll(businessId: string, limit: number, skip: number): Promise<Customer[]> {
    return cs(
      this.prisma.customer.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
    );
  }

  create(data: CreateCustomerData): Promise<Customer> {
    return c(this.prisma.customer.create({ data }));
  }

  update(id: string, data: UpdateCustomerData): Promise<Customer> {
    return c(this.prisma.customer.update({ where: { id }, data }));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.customer.delete({ where: { id } });
  }
}
