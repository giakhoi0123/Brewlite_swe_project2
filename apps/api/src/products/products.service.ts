import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OptionType } from '@prisma/client';
import {
  ProductsRepository,
  ProductWithDetails,
  ProductWithInventory,
} from './products.repository';
import { GetProductsQueryDto } from './dto/get-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { ProductDetailResponseDto } from './dto/product-detail-response.dto';
import {
  CheckProductAvailabilityDto,
  ProductAvailabilityResponseDto,
} from './dto/check-product-availability.dto';
import {
  calculateRecipeCapacity,
  RecipeCapacityError,
  RecipeRequirementItem,
} from './helpers/recipe-capacity.helper';

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

  async checkAvailability(
    productId: string,
    dto: CheckProductAvailabilityDto,
  ): Promise<ProductAvailabilityResponseDto> {
    const uniqueIds = new Set(dto.selectedOptions);
    if (uniqueIds.size !== dto.selectedOptions.length) {
      throw new BadRequestException('Danh sách selectedOptions không được chứa tùy chọn trùng lặp');
    }

    const product = await this.productsRepository.findProductWithOptionsAndRecipes(
      productId,
      dto.selectedOptions,
    );

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    if (product.options.length !== dto.selectedOptions.length) {
      throw new BadRequestException(
        'Một hoặc nhiều tùy chọn không tồn tại hoặc không thuộc về sản phẩm này',
      );
    }

    const sizeOptions = product.options.filter((opt) => opt.type === OptionType.SIZE);
    if (sizeOptions.length !== 1) {
      throw new BadRequestException(
        sizeOptions.length === 0
          ? 'Đơn chọn món bắt buộc phải có đúng một tùy chọn kích thước (SIZE)'
          : 'Không thể chọn nhiều hơn một tùy chọn kích thước (SIZE)',
      );
    }

    const invalidOptions = product.options.filter(
      (opt) => opt.type !== OptionType.SIZE && opt.type !== OptionType.TOPPING,
    );
    if (invalidOptions.length > 0) {
      throw new BadRequestException('Chỉ hỗ trợ tùy chọn thuộc loại SIZE hoặc TOPPING');
    }

    const hasOptionWithoutRecipe = product.options.some(
      (opt) => !opt.recipes || opt.recipes.length === 0,
    );
    if (hasOptionWithoutRecipe) {
      return {
        productId: product.id,
        availableStock: 0,
        canOrder: false,
      };
    }

    const recipeLines: RecipeRequirementItem[] = product.options.flatMap((opt) =>
      opt.recipes.map((r) => ({
        ingredientId: r.ingredient.id,
        stock: r.ingredient.stock,
        amount: r.amount,
      })),
    );

    try {
      const capacity = calculateRecipeCapacity(recipeLines);
      const availableStock = capacity;
      const canOrder = product.isAvailable && availableStock > 0;

      return {
        productId: product.id,
        availableStock,
        canOrder,
      };
    } catch (error) {
      if (error instanceof RecipeCapacityError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
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
