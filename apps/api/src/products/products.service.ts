import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ProductsRepository,
  ProductWithDetails,
  ProductWithInventory,
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

  private mapToProductResponse(product: ProductWithInventory): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      canOrder: product.isAvailable && this.availableStock(product.inventory) > 0,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private mapToProductDetailResponse(product: ProductWithDetails): ProductDetailResponseDto {
    return {
      ...this.mapToProductResponse(product),
      options: product.options.map((opt) => ({
        id: opt.id,
        type: opt.type,
        name: opt.name,
        extraPrice: Number(opt.extraPrice),
      })),
      inventory: product.inventory
        ? {
            quantity: product.inventory.quantity,
            reserved: product.inventory.reserved,
            availableStock: this.availableStock(product.inventory),
          }
        : null,
    };
  }

  private availableStock(inventory: ProductWithInventory['inventory']): number {
    return inventory ? Math.max(0, inventory.quantity - inventory.reserved) : 0;
  }
}
