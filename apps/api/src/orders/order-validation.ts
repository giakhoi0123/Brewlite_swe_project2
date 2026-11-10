import { OptionType, Prisma } from '@prisma/client';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import {
  DuplicateProductOptionException,
  IngredientNotFoundException,
  MissingSizeOptionException,
  MultipleSizeOptionsException,
  OptionMissingRecipeException,
  ProductNotFoundException,
  ProductOptionMismatchException,
  ProductOptionNotFoundException,
  ProductUnavailableException,
} from './orders.exceptions';

export interface ValidatedRecipe {
  productOptionId?: string;
  ingredientId: string;
  amount: Prisma.Decimal;
  ingredient?: {
    id: string;
    name: string;
  } | null;
}

export interface ValidatedOption {
  id: string;
  productId: string;
  name: string;
  type: OptionType;
  extraPrice: Prisma.Decimal;
  recipes: ValidatedRecipe[];
}

export interface ValidatedProduct {
  id: string;
  name: string;
  basePrice: Prisma.Decimal;
  isAvailable: boolean;
}

export interface ValidatedItemSelection {
  product: ValidatedProduct;
  quantity: number;
  options: ValidatedOption[];
  notes?: string;
}

/**
 * Pure helper xác thực sự hợp lệ về mặt nghiệp vụ của các món và tùy chọn trong đơn hàng:
 * 1. Mọi productId phải tồn tại trong DB.
 * 2. Mọi Product phải đang mở bán (isAvailable = true).
 * 3. Mỗi OrderItem bắt buộc phải có đúng 1 tùy chọn kích cỡ (SIZE).
 * 4. Cho phép 0 hoặc nhiều tùy chọn TOPPING.
 * 5. Mọi ProductOption phải thuộc đúng productId của món hàng đó.
 * 6. Không chấp nhận tùy chọn trùng lặp trong cùng 1 món.
 * 7. Mọi tùy chọn phải có ít nhất 1 OptionRecipe được định nghĩa.
 * 8. Mọi OptionRecipe phải có Ingredient tồn tại.
 */
export function validateOrderSelection(
  itemDtos: CreateOrderItemDto[],
  productsMap: Map<string, ValidatedProduct>,
  optionsMap: Map<string, ValidatedOption>,
): ValidatedItemSelection[] {
  const validatedItems: ValidatedItemSelection[] = [];

  for (const dto of itemDtos) {
    // 1. Kiểm tra Product tồn tại
    const product = productsMap.get(dto.productId);
    if (!product) {
      throw new ProductNotFoundException(dto.productId);
    }

    // 2. Kiểm tra Product đang mở bán
    if (!product.isAvailable) {
      throw new ProductUnavailableException(product.id, product.name);
    }

    const selectedOptionIds = dto.selectedOptions ?? [];

    // 3. Kiểm tra trùng lặp option ID (defense-in-depth)
    const seenOptionIds = new Set<string>();
    for (const optId of selectedOptionIds) {
      if (seenOptionIds.has(optId)) {
        throw new DuplicateProductOptionException(optId);
      }
      seenOptionIds.add(optId);
    }

    const itemOptions: ValidatedOption[] = [];
    let sizeCount = 0;

    for (const optId of selectedOptionIds) {
      // 4. Kiểm tra Option tồn tại
      const option = optionsMap.get(optId);
      if (!option) {
        throw new ProductOptionNotFoundException(optId);
      }

      // 5. Kiểm tra Option phải thuộc về đúng Product của OrderItem
      if (option.productId !== product.id) {
        throw new ProductOptionMismatchException(option.id, product.id);
      }

      // 6. Kiểm tra Option phải có ít nhất 1 OptionRecipe
      if (!option.recipes || option.recipes.length === 0) {
        throw new OptionMissingRecipeException(option.id, option.name);
      }

      // 7. Kiểm tra recipe có ingredient hợp lệ
      for (const recipe of option.recipes) {
        if (!recipe.ingredientId) {
          throw new IngredientNotFoundException('unknown');
        }
      }

      if (option.type === OptionType.SIZE) {
        sizeCount++;
      }

      itemOptions.push(option);
    }

    // 8. Xác minh chính xác 1 SIZE
    if (sizeCount === 0) {
      throw new MissingSizeOptionException(product.id);
    }
    if (sizeCount > 1) {
      throw new MultipleSizeOptionsException(product.id, sizeCount);
    }

    validatedItems.push({
      product,
      quantity: dto.quantity,
      options: itemOptions,
      notes: dto.notes,
    });
  }

  return validatedItems;
}
