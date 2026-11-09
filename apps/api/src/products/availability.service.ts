import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async check(input: CheckAvailabilityDto) {
    // Aggregate ingredient demand across all lines, including shared size/topping ingredients.
    const products = await this.prisma.product.findMany({
      where: { id: { in: input.items.map(i => i.productId) } },
      include: { options: { include: { recipes: { include: { ingredient: true } } } } },
    });
    const stocks = new Map<string, Prisma.Decimal>();
    const demand = new Map<string, Prisma.Decimal>();
    const lines = input.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new BadRequestException('Sản phẩm không tồn tại.');
      const size = product.options.find(o => o.id === item.sizeId && o.type === 'SIZE');
      const toppings = item.toppingIds.map(id => product.options.find(o => o.id === id && o.type === 'TOPPING'));
      if (!size || toppings.some(o => !o)) throw new BadRequestException('Size hoặc topping không thuộc sản phẩm.');
      const options = [size, ...toppings.filter((o): o is NonNullable<typeof o> => !!o)];
      const amounts = new Map<string, Prisma.Decimal>();
      for (const option of options) for (const recipe of option.recipes) {
        if (recipe.amount.lte(0)) throw new BadRequestException('Công thức không hợp lệ.');
        stocks.set(recipe.ingredientId, recipe.ingredient.stock);
        amounts.set(recipe.ingredientId, (amounts.get(recipe.ingredientId) ?? new Prisma.Decimal(0)).plus(recipe.amount));
      }
      for (const [id, amount] of amounts) demand.set(id, (demand.get(id) ?? new Prisma.Decimal(0)).plus(amount.mul(item.quantity)));
      return { item, amounts, enabled: product.isAvailable && options.every(o => o.recipes.length > 0) };
    });
    const results = lines.map(({ item, amounts, enabled }, index) => {
      let capacity = Number.MAX_SAFE_INTEGER;
      for (const [id, amount] of amounts) {
        const remaining = stocks.get(id)!.minus(demand.get(id)!.minus(amount.mul(item.quantity)));
        capacity = Math.min(capacity, Math.max(0, remaining.div(amount).floor().toNumber()));
      }
      const availableQuantity = enabled && amounts.size ? capacity : 0;
      return { index, productId: item.productId, sizeId: item.sizeId, requestedQuantity: item.quantity,
        availableQuantity, canOrder: item.quantity <= availableQuantity };
    });
    return { canOrder: results.every(r => r.canOrder), items: results };
  }
}
