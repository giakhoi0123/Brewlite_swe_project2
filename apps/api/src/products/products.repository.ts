import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Product, ProductOption, Inventory } from '@prisma/client';

export type ProductWithDetails = Product & {
  options: ProductOption[];
  inventory: Inventory | null;
};

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(search?: string): Promise<Product[]> {
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
        inventory: true,
      },
    });
  }
}
