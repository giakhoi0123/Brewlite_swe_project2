import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository, ProductWithDetails } from './products.repository';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductDetailResponseDto } from './dto/product-detail-response.dto';
import { Product } from '@prisma/client';

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

  private mapToProductResponse(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private mapToProductDetailResponse(product: ProductWithDetails): ProductDetailResponseDto {
    return {
      id: product.id,
      name: product.name,
      basePrice: Number(product.basePrice),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      createdAt: product.createdAt.toISOString(),
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
            availableStock: Math.max(0, product.inventory.quantity - product.inventory.reserved),
          }
        : null,
    };
  }
}
