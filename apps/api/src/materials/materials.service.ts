import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaginationParams } from '../common/dto/pagination.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  create(businessId: string, dto: CreateMaterialDto) {
    const unitPrice = dto.purchasePrice / dto.purchaseQty;
    const initialQty = dto.initialQty ?? 0;
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.create({
        data: {
          businessId,
          name: dto.name,
          unit: dto.unit,
          purchasePrice: dto.purchasePrice,
          purchaseQty: dto.purchaseQty,
          unitPrice,
          reorderLevel: dto.reorderLevel,
          vatRate: dto.vatRate ?? 0,
          stockQty: initialQty,
        },
      });
      await this.inventoryService.recordOpeningBalance(tx, businessId, material.id, initialQty);
      return material;
    });
  }

  findAll(businessId: string, pagination: PaginationParams) {
    return this.prisma.material.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: pagination.limit,
      skip: pagination.skip,
    });
  }

  async findOne(businessId: string, id: string) {
    const material = await this.prisma.material.findFirst({ where: { id, businessId } });
    if (!material) {
      throw new NotFoundException('Material not found');
    }
    return material;
  }

  async update(businessId: string, id: string, dto: UpdateMaterialDto) {
    const material = await this.findOne(businessId, id);

    const purchasePrice = dto.purchasePrice ?? material.purchasePrice;
    const purchaseQty = dto.purchaseQty ?? material.purchaseQty;
    const unitPrice = purchasePrice / purchaseQty;
    const priceChanged = unitPrice !== material.unitPrice;

    // Price edits and the re-costing of dependent products stay atomic.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.material.update({
        where: { id },
        data: {
          name: dto.name ?? material.name,
          unit: dto.unit ?? material.unit,
          purchasePrice,
          purchaseQty,
          unitPrice,
          reorderLevel: dto.reorderLevel ?? material.reorderLevel,
          vatRate: dto.vatRate ?? material.vatRate,
        },
      });
      if (priceChanged) {
        await this.inventoryService.recostMaterials(tx, businessId, [id]);
      }
      return updated;
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);

    // A material referenced by recipes, purchases, or stock movements can't
    // be hard-deleted without corrupting history — surface a clear Arabic
    // message instead of a foreign-key 500.
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
