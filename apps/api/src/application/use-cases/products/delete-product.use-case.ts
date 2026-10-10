import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRODUCT_REPOSITORY, IProductRepository } from '../../ports/repositories/product.repository.port';

@Injectable()
export class DeleteProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
  ) {}

  async execute(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const product = await this.productRepo.findById(businessId, id);
    if (!product) throw new NotFoundException('Product not found');
    await this.productRepo.remove(id);
    return { deleted: true };
  }
}
