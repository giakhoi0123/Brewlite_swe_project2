import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sprint 1 Menu PostgreSQL Contract Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses the dedicated PostgreSQL test database', async () => {
    const rows = await prisma.$queryRaw<Array<{ databaseName: string }>>`
      SELECT current_database() AS "databaseName"
    `;

    expect(rows).toHaveLength(1);
    expect(rows[0].databaseName).toMatch(/(^|[-_])test($|[-_])/);
  });

  it('maps the persisted seed list to the frontend Product contract', async () => {
    const persistedProducts = await prisma.product.findMany({
      orderBy: { name: 'asc' },
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

    const listRes = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);

    expect(listRes.body).toHaveLength(persistedProducts.length);
    expect(persistedProducts).toHaveLength(8);
    expect(listRes.body.map((product: { id: string }) => product.id))
      .toEqual(persistedProducts.map(product => product.id));

    const calculateCapacity = (product: typeof persistedProducts[0]) => {
      const sizes = product.options.filter((o) => o.type === 'SIZE');
      return Math.max(
        0,
        ...sizes.map((size) =>
          size.recipes.length
            ? Math.min(
                ...size.recipes.map((r) =>
                  Number(r.amount) > 0
                    ? Math.floor(Number(r.ingredient.stock) / Number(r.amount))
                    : 0,
                ),
              )
            : 0,
        ),
      );
    };

    for (const persistedProduct of persistedProducts) {
      const apiProduct = listRes.body.find(
        (product: { id: string }) => product.id === persistedProduct.id,
      );

      const capacity = calculateCapacity(persistedProduct);

      expect(apiProduct).toEqual({
        id: persistedProduct.id,
        name: persistedProduct.name,
        basePrice: Number(persistedProduct.basePrice),
        imageUrl: persistedProduct.imageUrl,
        isAvailable: persistedProduct.isAvailable,
        canOrder: persistedProduct.isAvailable && capacity > 0,
        createdAt: persistedProduct.createdAt.toISOString(),
      });
    }
  });

  it('maps PostgreSQL options and recipe-based inventory compatibility to the frontend detail contract', async () => {
    const productId = 'a0000000-0000-0000-0000-000000000008';
    const persistedProduct = await prisma.product.findUnique({
      where: { id: productId },
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

    expect(persistedProduct).not.toBeNull();

    // Capacity calculated from sizes & bottleneck ingredient
    const sizes = persistedProduct!.options.filter((o) => o.type === 'SIZE');
    const expectedRecipeCapacity = Math.max(
      0,
      ...sizes.map((size) =>
        size.recipes.length
          ? Math.min(
              ...size.recipes.map((r) =>
                Number(r.amount) > 0
                  ? Math.floor(Number(r.ingredient.stock) / Number(r.amount))
                  : 0,
              ),
            )
          : 0,
      ),
    );

    const detailRes = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .expect(200);

    expect(detailRes.body).toMatchObject({
      id: persistedProduct!.id,
      name: persistedProduct!.name,
      basePrice: Number(persistedProduct!.basePrice),
      imageUrl: persistedProduct!.imageUrl,
      isAvailable: persistedProduct!.isAvailable,
      createdAt: persistedProduct!.createdAt.toISOString(),
      inventory: {
        quantity: expectedRecipeCapacity,
        reserved: 0,
        availableStock: expectedRecipeCapacity,
      },
    });
    expect(Array.isArray(detailRes.body.options)).toBe(true);
    expect(detailRes.body.options).toHaveLength(persistedProduct!.options.length);

    for (const persistedOption of persistedProduct!.options) {
      expect(detailRes.body.options).toContainEqual({
        id: persistedOption.id,
        type: persistedOption.type,
        name: persistedOption.name,
        extraPrice: Number(persistedOption.extraPrice),
      });
    }
  });
});
