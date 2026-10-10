import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MATERIAL_REPOSITORY, IMaterialRepository } from '../../ports/repositories/material.repository.port';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeleteMaterialUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY) private readonly materialRepo: IMaterialRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const material = await this.materialRepo.findById(businessId, id);
    if (!material) throw new NotFoundException('Material not found');

    const [recipeRefs, purchaseRefs, movementRefs] = await Promise.all([
      this.prisma.recipeItem.count({ where: { materialId: id } }),
      this.prisma.purchaseItem.count({ where: { materialId: id } }),
      this.prisma.stockMovement.count({ where: { materialId: id } }),
    ]);

    if (recipeRefs > 0 || purchaseRefs > 0) {
      throw new BadRequestException(
        'لا يمكن حذف الصنف لأنه مرتبط بوصفات منتجات أو فواتير شراء. عدّل كميته إلى صفر بدلًا من حذفه.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (movementRefs > 0) {
        await tx.stockMovement.deleteMany({ where: { materialId: id } });
      }
      await tx.material.delete({ where: { id } });
    });

    return { deleted: true };
  }
}
