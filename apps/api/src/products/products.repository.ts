import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

const productWithDetails = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    options: {
      include: { recipes: { include: { ingredient: true } } },
    },
  },
});

export type ProductWithDetails = Prisma.ProductGetPayload<typeof productWithDetails>;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(search?: string): Promise<ProductWithDetails[]> {
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
      include: {
        options: { include: { recipes: { include: { ingredient: true } } } },
      },
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
      },
    });
  }
}
