import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecipeItemType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CalculateProductDto } from './dto/calculate-product.dto';
import { RecipeItemDto } from './dto/recipe-item.dto';

interface ComputedCosts {
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single source of truth for the recipe-cost-calculator math. Never trust
   * client-sent totals — always recompute from raw recipe items server-side.
   *
   *   lineCost      = unitPrice * quantityUsed
   *   rawCost       = sum(lineCost) where type = RAW
   *   packagingCost = sum(lineCost) where type = PACKAGING
   *   totalCost     = rawCost + packagingCost + overheadCost
   *   sellingPrice  = totalCost / (1 - profitMargin / 100)
   *                   (profitMargin is % of selling price, not markup on cost)
   */
  computeCosts(items: RecipeItemDto[], overheadCost: number, profitMargin: number): ComputedCosts {
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const rawCost = items
      .filter((i) => i.type === RecipeItemType.RAW)
      .reduce((sum, i) => sum + i.unitPrice * i.quantityUsed, 0);

    const packagingCost = items
      .filter((i) => i.type === RecipeItemType.PACKAGING)
      .reduce((sum, i) => sum + i.unitPrice * i.quantityUsed, 0);

    const totalCost = rawCost + packagingCost + overheadCost;
    const divisor = 1 - profitMargin / 100;
    const sellingPrice = divisor > 0 ? totalCost / divisor : totalCost;

    return {
      rawCost: round2(rawCost),
      packagingCost: round2(packagingCost),
      totalCost: round2(totalCost),
      sellingPrice: round2(sellingPrice),
    };
  }

  calculate(dto: CalculateProductDto): ComputedCosts {
    return this.computeCosts(dto.recipeItems, dto.overheadCost ?? 0, dto.profitMargin);
  }

  /**
   * When a material's unit cost changes (purchase, manual price edit...),
   * refresh every recipe line that references it and recompute the owning
   * products' costs. Accepts a transaction client so callers can keep the
   * price change and the re-costing atomic.
   */
  async recostProductsUsingMaterials(
    db: Prisma.TransactionClient,
    businessId: string,
    materialIds: string[],
  ) {
    const ids = [...new Set(materialIds)];
    if (ids.length === 0) return;

    const materials = await db.material.findMany({
      where: { id: { in: ids } },
      select: { id: true, unitPrice: true },
    });
    const priceById = new Map(materials.map((m) => [m.id, m.unitPrice]));

    const affectedLines = await db.recipeItem.findMany({
      where: { materialId: { in: ids }, product: { businessId } },
      select: { productId: true },
      distinct: ['productId'],
    });

    for (const { productId } of affectedLines) {
      const product = await db.product.findUnique({
        where: { id: productId },
        include: { recipeItems: true },
      });
      if (!product) continue;

      for (const line of product.recipeItems) {
        const newPrice = line.materialId ? priceById.get(line.materialId) : undefined;
        if (newPrice !== undefined && newPrice !== line.unitPrice) {
          await db.recipeItem.update({
            where: { id: line.id },
            data: { unitPrice: newPrice, lineCost: newPrice * line.quantityUsed },
          });
          line.unitPrice = newPrice;
        }
      }

      const costs = this.computeCosts(
        product.recipeItems.map((i) => ({
          materialId: i.materialId ?? undefined,
          name: i.name,
          unit: i.unit,
          unitPrice: i.unitPrice,
          quantityUsed: i.quantityUsed,
          type: i.type,
        })),
        product.overheadCost,
        product.profitMargin,
      );

      await db.product.update({
        where: { id: productId },
        data: {
          rawCost: costs.rawCost,
          packagingCost: costs.packagingCost,
          totalCost: costs.totalCost,
          sellingPrice: costs.sellingPrice,
        },
      });
    }
  }

  async create(businessId: string, dto: CreateProductDto) {
    const overheadCost = dto.overheadCost ?? 0;
    const costs = this.computeCosts(dto.recipeItems, overheadCost, dto.profitMargin);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          name: dto.name,
          category: dto.category,
          overheadCost,
          profitMargin: dto.profitMargin,
          rawCost: costs.rawCost,
          packagingCost: costs.packagingCost,
          totalCost: costs.totalCost,
          sellingPrice: costs.sellingPrice,
          recipeItems: {
            create: dto.recipeItems.map((item) => ({
              materialId: item.materialId,
              name: item.name,
              unit: item.unit,
              unitPrice: item.unitPrice,
              quantityUsed: item.quantityUsed,
              lineCost: item.unitPrice * item.quantityUsed,
              type: item.type,
            })),
          },
        },
        include: { recipeItems: true },
      });

      return product;
    });
  }

  findAll(businessId: string) {
    return this.prisma.product.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: { recipeItems: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(businessId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.findOne(businessId, id);

    const overheadCost = dto.overheadCost ?? existing.overheadCost;
    const profitMargin = dto.profitMargin ?? existing.profitMargin;

    // If recipeItems weren't sent, keep existing items for cost recomputation.
    const itemsForCalc: RecipeItemDto[] =
      dto.recipeItems ??
      existing.recipeItems.map((i) => ({
        materialId: i.materialId ?? undefined,
        name: i.name,
        unit: i.unit,
        unitPrice: i.unitPrice,
        quantityUsed: i.quantityUsed,
        type: i.type,
      }));

    const costs = this.computeCosts(itemsForCalc, overheadCost, profitMargin);

    return this.prisma.$transaction(async (tx) => {
      if (dto.recipeItems) {
        await tx.recipeItem.deleteMany({ where: { productId: id } });
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          category: dto.category ?? existing.category,
          overheadCost,
          profitMargin,
          rawCost: costs.rawCost,
          packagingCost: costs.packagingCost,
          totalCost: costs.totalCost,
          sellingPrice: costs.sellingPrice,
          ...(dto.recipeItems
            ? {
                recipeItems: {
                  create: dto.recipeItems.map((item) => ({
                    materialId: item.materialId,
                    name: item.name,
                    unit: item.unit,
                    unitPrice: item.unitPrice,
                    quantityUsed: item.quantityUsed,
                    lineCost: item.unitPrice * item.quantityUsed,
                    type: item.type,
                  })),
                },
              }
            : {}),
        },
        include: { recipeItems: true },
      });

      return updated;
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
