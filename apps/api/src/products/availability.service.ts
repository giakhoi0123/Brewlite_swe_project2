import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import {
  calculateRecipeCapacity,
  InvalidRecipeAmountError,
  NegativeStockError,
  InconsistentStockError,
  RecipeRequirementItem,
} from './helpers/recipe-capacity.helper';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async check(input: CheckAvailabilityDto) {
    // 1. Lấy thông tin các sản phẩm cùng options và công thức nguyên liệu
    const products = await this.prisma.product.findMany({
      where: { id: { in: input.items.map((i) => i.productId) } },
      include: {
        options: {
          include: {
            recipes: {
              include: { ingredient: true },
            },
          },
        },
      },
    });

    const stocks = new Map<string, Prisma.Decimal>();
    const demand = new Map<string, Prisma.Decimal>();

    // 2. Kiểm tra tính hợp lệ của từng dòng sản phẩm, options, recipes và tổng hợp demand
    const lines = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException('Sản phẩm không tồn tại.');
      }

      const size = product.options.find(
        (o) => o.id === item.sizeId && o.type === 'SIZE',
      );
      const toppings = item.toppingIds.map((id) =>
        product.options.find((o) => o.id === id && o.type === 'TOPPING'),
      );

      if (!size || toppings.some((o) => !o)) {
        throw new BadRequestException('Size hoặc topping không thuộc sản phẩm.');
      }

      const options = [
        size,
        ...toppings.filter((o): o is NonNullable<typeof o> => !!o),
      ];

      const amounts = new Map<string, Prisma.Decimal>();
      for (const option of options) {
        for (const recipe of option.recipes) {
          if (recipe.amount.lte(0)) {
            throw new BadRequestException('Công thức không hợp lệ.');
          }

          // Stock gốc database âm là lỗi invariant dữ liệu hệ thống, ném InternalServerErrorException
          if (recipe.ingredient.stock.lt(0)) {
            throw new InternalServerErrorException(
              'Lỗi dữ liệu tồn kho hệ thống.',
            );
          }

          const existingStock = stocks.get(recipe.ingredientId);
          if (
            existingStock !== undefined &&
            !existingStock.equals(recipe.ingredient.stock)
          ) {
            throw new InternalServerErrorException(
              'Lỗi dữ liệu tồn kho hệ thống.',
            );
          }

          stocks.set(recipe.ingredientId, recipe.ingredient.stock);
          amounts.set(
            recipe.ingredientId,
            (amounts.get(recipe.ingredientId) ?? new Prisma.Decimal(0)).plus(
              recipe.amount,
            ),
          );
        }
      }

      for (const [id, amount] of amounts) {
        demand.set(
          id,
          (demand.get(id) ?? new Prisma.Decimal(0)).plus(
            amount.mul(item.quantity),
          ),
        );
      }

      return {
        item,
        amounts,
        enabled: product.isAvailable && options.every((o) => o.recipes.length > 0),
      };
    });

    // 3. Tính toán capacity cho từng dòng dựa trên pure helper calculateRecipeCapacity
    const results = lines.map(({ item, amounts, enabled }, index) => {
      let availableQuantity = 0;

      if (enabled && amounts.size > 0) {
        let hasDepletedIngredient = false;
        const recipeItems: RecipeRequirementItem[] = [];

        for (const [id, amount] of amounts) {
          const originalStock = stocks.get(id);
          // Kiểm tra sự tồn tại và tính hợp lệ của stock gốc database
          if (!originalStock) {
            throw new InternalServerErrorException(
              'Lỗi dữ liệu tồn kho hệ thống.',
            );
          }
          if (originalStock.lt(0)) {
            throw new InternalServerErrorException(
              'Lỗi dữ liệu tồn kho hệ thống.',
            );
          }

          const totalDemand = demand.get(id);
          if (!totalDemand) {
            throw new InternalServerErrorException(
              'Lỗi dữ liệu tính toán nhu cầu nguyên liệu.',
            );
          }

          const otherLinesDemand = totalDemand.minus(amount.mul(item.quantity));
          const remaining = originalStock.minus(otherLinesDemand);

          // Phân biệt:
          // Nếu remaining <= 0 do demand của các dòng khác:
          // Đây là tình trạng hết hàng bình thường của dòng này, capacity = 0.
          // Không throw lỗi và không truyền số âm vào helper.
          if (remaining.lte(0)) {
            hasDepletedIngredient = true;
            break;
          }

          recipeItems.push({
            ingredientId: id,
            stock: remaining,
            amount,
          });
        }

        if (!hasDepletedIngredient && recipeItems.length > 0) {
          try {
            availableQuantity = calculateRecipeCapacity(recipeItems);
          } catch (error) {
            if (error instanceof InvalidRecipeAmountError) {
              throw new BadRequestException('Công thức không hợp lệ.');
            }
            if (
              error instanceof NegativeStockError ||
              error instanceof InconsistentStockError
            ) {
              throw new InternalServerErrorException(
                'Lỗi dữ liệu tồn kho hệ thống.',
              );
            }
            // Lỗi không xác định: rethrow để NestJS xử lý thành HTTP 500 theo cơ chế chuẩn
            throw error;
          }
        }
      }

      return {
        index,
        productId: item.productId,
        sizeId: item.sizeId,
        requestedQuantity: item.quantity,
        availableQuantity,
        canOrder: item.quantity <= availableQuantity,
      };
    });

    return {
      canOrder: results.every((r) => r.canOrder),
      items: results,
    };
  }
}
