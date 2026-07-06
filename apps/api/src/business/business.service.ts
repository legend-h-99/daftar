import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CurrentUserData } from '../common/types/auth.types';

@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(user: CurrentUserData, dto: CreateBusinessDto) {
    if (user.businessId) {
      throw new BadRequestException('This account is already linked to a business');
    }

    const existing = await this.prisma.business.findUnique({
      where: { ownerPhone: user.phone },
    });
    if (existing) {
      throw new ConflictException('A business already exists for this phone number');
    }

    const business = await this.prisma.business.create({
      data: {
        name: dto.name,
        ownerPhone: user.phone,
        vatEnabled: dto.vatEnabled,
        vatNumber: dto.vatNumber,
        city: dto.city,
      },
    });

    await this.prisma.user.update({
      where: { id: user.userId },
      data: { businessId: business.id },
    });

    const accessToken = this.authService.signToken({
      sub: user.userId,
      phone: user.phone,
      businessId: business.id,
    });

    return { accessToken, business };
  }

  async findCurrent(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async update(businessId: string, dto: UpdateBusinessDto) {
    await this.assertExists(businessId);
    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: dto.name,
        vatEnabled: dto.vatEnabled,
        vatNumber: dto.vatNumber,
        city: dto.city,
      },
    });
  }

  private async assertExists(businessId: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
  }
}
