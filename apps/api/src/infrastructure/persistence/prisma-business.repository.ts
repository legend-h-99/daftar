import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IBusinessRepository } from '../../application/ports/repositories/business.repository.port';
import { Business } from '../../domain/entities/business.entity';

@Injectable()
export class PrismaBusinessRepository implements IBusinessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Business | null> {
    return this.prisma.business.findUnique({ where: { id } });
  }
}
