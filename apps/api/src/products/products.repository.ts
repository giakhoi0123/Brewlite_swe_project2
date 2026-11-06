import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type ProductWithInventory = Prisma.ProductGetPayload<{
  include: { inventory: { select: { quantity: true; reserved: true } }; options: { include: { recipes: { include: { ingredient: true } } } } };
}>;

export type ProductWithDetails = ProductWithInventory & {

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
      include: { inventory: { select: { quantity: true, reserved: true } }, options: { include: { recipes: { include: { ingredient: true } } } } },
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
          include: { recipes: { include: { ingredient: true } } },
          orderBy: [
            { type: 'asc' },
            { extraPrice: 'asc' },
          ],
        },
        inventory: { select: { quantity: true, reserved: true } },
      },
    });
  }
}
