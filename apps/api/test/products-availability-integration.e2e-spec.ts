import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OptionType, IngredientUnit, Prisma } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductResponseDto } from '../src/products/dto/product-response.dto';
import { ProductDetailResponseDto } from '../src/products/dto/product-detail-response.dto';

type LegacyStock = { quantity: number; reserved: number };

interface FixtureConfig {
  isAvailable: boolean;
  ingredientStock: number;
  hasRecipe?: boolean;
  legacyInventory?: LegacyStock | null;
}

describe('Products availability PostgreSQL integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtureId: string;
  let fixtureName: string;
  let fixtureIngredientId: string;
  let regularSizeId: string;
  let largeSizeId: string;
  let toppingId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    fixtureId = randomUUID();
    fixtureName = `Task51 Availability ${fixtureId}`;
    fixtureIngredientId = randomUUID();
    regularSizeId = randomUUID();
    largeSizeId = randomUUID();
    toppingId = randomUUID();
  });

  afterEach(async () => {
    // Clean up only this test's fixtures in correct cascade order
    if (prisma) {
      if (regularSizeId || largeSizeId) {
        await prisma.optionRecipe.deleteMany({
          where: { productOptionId: { in: [regularSizeId, largeSizeId, toppingId] } },
        });
      }
      if (fixtureId) {
        await prisma.productOption.deleteMany({ where: { productId: fixtureId } });
        await prisma.inventory.deleteMany({ where: { productId: fixtureId } });
        await prisma.product.deleteMany({ where: { id: fixtureId } });
      }
      if (fixtureIngredientId) {
        await prisma.ingredient.deleteMany({ where: { id: fixtureIngredientId } });
      }
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createFixture({
    isAvailable,
    ingredientStock,
    hasRecipe = true,
    legacyInventory = null,
  }: FixtureConfig) {
    // 1. Create dedicated test Ingredient
    await prisma.ingredient.create({
      data: {
        id: fixtureIngredientId,
        name: `Task51 Coffee Bean ${fixtureIngredientId}`,
        unit: IngredientUnit.G,
        stock: new Prisma.Decimal(ingredientStock.toString()),
        version: 1,
      },
    });

    // 2. Create Product with optional legacy inventory and options
    await prisma.product.create({
      data: {
        id: fixtureId,
        name: fixtureName,
        basePrice: 25000,
        imageUrl: 'https://example.com/task51-coffee.jpg',
        isAvailable,
        ...(legacyInventory ? { inventory: { create: legacyInventory } } : {}),
        options: {
          create: [
            { id: toppingId, type: OptionType.TOPPING, name: 'Coffee jelly', extraPrice: 5000 },
            { id: largeSizeId, type: OptionType.SIZE, name: 'Large', extraPrice: 6000 },
            { id: regularSizeId, type: OptionType.SIZE, name: 'Regular', extraPrice: 0 },
          ],
        },
      },
    });

    // 3. Create OptionRecipes (Regular = 20g, Large = 30g)
    if (hasRecipe) {
      await prisma.optionRecipe.createMany({
        data: [
          {
            productOptionId: regularSizeId,
            ingredientId: fixtureIngredientId,
            amount: new Prisma.Decimal('20.000'),
          },
          {
            productOptionId: largeSizeId,
            ingredientId: fixtureIngredientId,
            amount: new Prisma.Decimal('30.000'),
          },
        ],
      });
    }
  }

  async function readAllEndpoints(isAvailable: boolean, canOrder: boolean) {
    const list = await request(app.getHttpServer()).get('/api/products').expect(200);
    const search = await request(app.getHttpServer())
      .get('/api/products')
      .query({ search: fixtureName.toUpperCase() })
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/products/${fixtureId}`)
      .expect(200);
    const listed = (list.body as ProductResponseDto[]).find((p) => p.id === fixtureId);

    expect(listed).toBeDefined();
    expect(search.body).toEqual([listed]);
    for (const product of [listed, search.body[0], detail.body]) {
      expect(product).toMatchObject({ id: fixtureId, isAvailable, canOrder });
    }
    // The list response keeps the catalog shape and does not expose inventory.
    expect(listed).not.toHaveProperty('inventory');
    expect(listed).not.toHaveProperty('options');
    return detail.body as ProductDetailResponseDto;
  }

  it.each([
    {
      label: 'available stock (recipe capacity determines availability regardless of legacy inventory)',
      isAvailable: true,
      ingredientStock: 100, // Regular needs 20g -> capacity = 5; Large needs 30g -> 3; Max = 5
      hasRecipe: true,
      legacyInventory: { quantity: 8, reserved: 3 },
      canOrder: true,
      expectedStock: 5,
    },
    {
      label: 'zero stock (0g ingredient gives 0 capacity)',
      isAvailable: true,
      ingredientStock: 0,
      hasRecipe: true,
      legacyInventory: { quantity: 15, reserved: 0 },
      canOrder: false,
      expectedStock: 0,
    },
    {
      label: 'recipe available while legacy inventory is 0 (recipe wins over legacy inventory)',
      isAvailable: true,
      ingredientStock: 100, // capacity = 5
      hasRecipe: true,
      legacyInventory: { quantity: 0, reserved: 0 },
      canOrder: true,
      expectedStock: 5,
    },
    {
      label: 'sale disabled (isAvailable = false blocks order even when ingredients are in stock)',
      isAvailable: false,
      ingredientStock: 100,
      hasRecipe: true,
      legacyInventory: { quantity: 8, reserved: 0 },
      canOrder: false,
      expectedStock: 5,
    },
    {
      label: 'missing recipe (options without recipe give capacity 0 and cannot order)',
      isAvailable: true,
      ingredientStock: 100,
      hasRecipe: false,
      legacyInventory: { quantity: 8, reserved: 0 },
      canOrder: false,
      expectedStock: 0,
    },
  ])(
    'returns consistent recipe-based state for $label',
    async ({
      isAvailable,
      ingredientStock,
      hasRecipe,
      legacyInventory,
      canOrder,
      expectedStock,
    }) => {
      await createFixture({ isAvailable, ingredientStock, hasRecipe, legacyInventory });
      const detail = await readAllEndpoints(isAvailable, canOrder);

      expect(detail.inventory).toEqual({
        quantity: expectedStock,
        reserved: 0,
        availableStock: expectedStock,
      });
      expect(detail.basePrice).toBe(25000);
      expect(detail.imageUrl).toBe('https://example.com/task51-coffee.jpg');
      expect(detail.options.map(({ type, name, extraPrice }) => ({ type, name, extraPrice }))).toEqual([
        { type: 'SIZE', name: 'Regular', extraPrice: 0 },
        { type: 'SIZE', name: 'Large', extraPrice: 6000 },
        { type: 'TOPPING', name: 'Coffee jelly', extraPrice: 5000 },
      ]);
    },
  );

  it('reflects ingredient stock replenishment on the next list, search and detail read', async () => {
    // 1. Initial state: stock = 0 -> canOrder = false, availableStock = 0
    await createFixture({
      isAvailable: true,
      ingredientStock: 0,
      hasRecipe: true,
      legacyInventory: null,
    });
    const before = await readAllEndpoints(true, false);
    expect(before.inventory?.availableStock).toBe(0);

    // 2. Replenish ingredient stock (100g / 20g = 5 cups)
    await prisma.ingredient.update({
      where: { id: fixtureIngredientId },
      data: { stock: new Prisma.Decimal('100.000') },
    });

    // 3. Immediately reflects new capacity on next read without restarting
    const after = await readAllEndpoints(true, true);
    expect(after.inventory).toEqual({ quantity: 5, reserved: 0, availableStock: 5 });
  });
});
