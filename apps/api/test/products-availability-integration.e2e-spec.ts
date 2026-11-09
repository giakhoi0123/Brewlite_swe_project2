import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IngredientUnit, OptionType } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductResponseDto } from '../src/products/dto/product-response.dto';
import { ProductDetailResponseDto } from '../src/products/dto/product-detail-response.dto';

describe('Products recipe availability PostgreSQL integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtureId: string;
  let fixtureName: string;
  let fixtureIngredientId: string;

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
  });

  afterEach(async () => {
    if (!prisma) return;
    await prisma.product.deleteMany({ where: { id: fixtureId } });
    await prisma.ingredient.deleteMany({ where: { id: fixtureIngredientId } });
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createFixture(isAvailable: boolean, ingredientStock: number | null) {
    const regularId = randomUUID();
    const largeId = randomUUID();

    if (ingredientStock !== null) {
      await prisma.ingredient.create({
        data: {
          id: fixtureIngredientId,
          name: `Task51 ingredient ${fixtureIngredientId}`,
          unit: IngredientUnit.ML,
          stock: ingredientStock,
        },
      });
    }

    await prisma.product.create({
      data: {
        id: fixtureId,
        name: fixtureName,
        basePrice: 25000,
        imageUrl: 'https://example.com/task51-coffee.jpg',
        isAvailable,
        options: {
          create: [
            { id: randomUUID(), type: OptionType.TOPPING, name: 'Coffee jelly', extraPrice: 5000 },
            { id: largeId, type: OptionType.SIZE, name: 'Large', extraPrice: 6000 },
            { id: regularId, type: OptionType.SIZE, name: 'Regular', extraPrice: 0 },
          ],
        },
      },
    });

    if (ingredientStock !== null) {
      await prisma.optionRecipe.createMany({
        data: [
          { productOptionId: regularId, ingredientId: fixtureIngredientId, amount: 2 },
          { productOptionId: largeId, ingredientId: fixtureIngredientId, amount: 4 },
        ],
      });
    }
  }

  async function readAllEndpoints(isAvailable: boolean, canOrder: boolean) {
    const list = await request(app.getHttpServer()).get('/api/products').expect(200);
    const search = await request(app.getHttpServer())
      .get('/api/products').query({ search: fixtureName.toUpperCase() }).expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/products/${fixtureId}`).expect(200);
    const listed = (list.body as ProductResponseDto[]).find(p => p.id === fixtureId);

    expect(listed).toBeDefined();
    expect(search.body).toEqual([listed]);
    for (const product of [listed, search.body[0], detail.body]) {
      expect(product).toMatchObject({ id: fixtureId, isAvailable, canOrder });
    }
    expect(listed).not.toHaveProperty('inventory');
    expect(listed).not.toHaveProperty('options');
    return detail.body as ProductDetailResponseDto;
  }

  it.each([
    { label: 'available ingredients', isAvailable: true, stock: 8, canOrder: true, capacity: 4 },
    { label: 'zero ingredients', isAvailable: true, stock: 0, canOrder: false, capacity: 0 },
    { label: 'sale disabled', isAvailable: false, stock: 8, canOrder: false, capacity: 4 },
    { label: 'missing recipes', isAvailable: true, stock: null, canOrder: false, capacity: 0 },
  ])('returns consistent state for $label', async ({ isAvailable, stock, canOrder, capacity }) => {
    await createFixture(isAvailable, stock);
    const detail = await readAllEndpoints(isAvailable, canOrder);

    expect(detail.inventory).toEqual({
      quantity: capacity,
      reserved: 0,
      availableStock: capacity,
    });
    expect(detail.basePrice).toBe(25000);
    expect(detail.imageUrl).toBe('https://example.com/task51-coffee.jpg');
    expect(detail.options.map(({ type, name, extraPrice }) => ({ type, name, extraPrice })))
      .toEqual([
        { type: 'SIZE', name: 'Regular', extraPrice: 0 },
        { type: 'SIZE', name: 'Large', extraPrice: 6000 },
        { type: 'TOPPING', name: 'Coffee jelly', extraPrice: 5000 },
      ]);
  });

  it('reflects an ingredient restock on the next list, search and detail read', async () => {
    await createFixture(true, 0);
    const before = await readAllEndpoints(true, false);
    expect(before.inventory?.availableStock).toBe(0);

    await prisma.ingredient.update({
      where: { id: fixtureIngredientId },
      data: { stock: 2 },
    });

    const after = await readAllEndpoints(true, true);
    expect(after.inventory).toEqual({ quantity: 1, reserved: 0, availableStock: 1 });
  });
});
