import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ProductsRepository,
  ProductWithDetails,
} from './products.repository';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductDetailResponseDto } from './dto/product-detail-response.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async findAll(query: GetProductsQueryDto): Promise<ProductResponseDto[]> {
    const products = await this.productsRepository.findMany(query.search);
    return products.map((product) => this.mapToProductResponse(product));
  }

  async findOne(id: string): Promise<ProductDetailResponseDto> {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    return this.mapToProductDetailResponse(product);
  }

  private mapToProductResponse(product: ProductWithDetails): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      canOrder: product.isAvailable && this.recipeCapacity(product) > 0,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private mapToProductDetailResponse(product: ProductWithDetails): ProductDetailResponseDto {
    const capacity = this.recipeCapacity(product);
    return {
      ...this.mapToProductResponse(product),
      options: product.options.map((opt) => ({
        id: opt.id,
        type: opt.type,
        name: opt.name,
        extraPrice: Number(opt.extraPrice),
      })),
      inventory: {
        quantity: capacity,
        reserved: 0,
        availableStock: capacity,
      },
    };
  }

  private recipeCapacity(product: ProductWithDetails): number {
    const sizes = (product.options ?? []).filter((o) => o.type === 'SIZE');
    return Math.max(
      0,
      ...sizes.map((size) =>
        size.recipes.length
          ? Math.min(
              ...size.recipes.map((r) =>
                r.amount.gt(0)
                  ? Math.max(0, r.ingredient.stock.div(r.amount).floor().toNumber())
                  : 0,
              ),
            )
          : 0,
      ),
    );
  }
}
