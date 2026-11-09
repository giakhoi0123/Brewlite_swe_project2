import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OptionType, Prisma, ProductOption } from '@prisma/client';

export type ProductWithInventory = Prisma.ProductGetPayload<{
  include: { inventory: { select: { quantity: true; reserved: true } } };
}>;

export type ProductWithDetails = ProductWithInventory & {
  options: ProductOption[];
};

export type ProductAvailabilityQueryResult = {
  id: string;
  isAvailable: boolean;
  options: {
    id: string;
    productId: string;
    type: OptionType;
    recipes: {
      amount: Prisma.Decimal;
      ingredient: {
        id: string;
        stock: Prisma.Decimal;
      };
    }[];
  }[];
};

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(search?: string): Promise<ProductWithInventory[]> {
    const whereClause = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {};

    return this.prisma.product.findMany({
      where: whereClause,
      include: { inventory: { select: { quantity: true, reserved: true } } },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string): Promise<ProductWithDetails | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: [
            { type: 'asc' },
            { extraPrice: 'asc' },
          ],
        },
        inventory: { select: { quantity: true, reserved: true } },
      },
    });
  }

  async findProductWithOptionsAndRecipes(
    productId: string,
    selectedOptionIds: string[],
  ): Promise<ProductAvailabilityQueryResult | null> {
    return this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        isAvailable: true,
        options: {
          where: {
            id: { in: selectedOptionIds },
          },
          select: {
            id: true,
            productId: true,
            type: true,
            recipes: {
              select: {
                amount: true,
                ingredient: {
                  select: {
                    id: true,
                    stock: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
