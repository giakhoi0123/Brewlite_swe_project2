import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OptionType } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductResponseDto } from '../src/products/dto/product-response.dto';
import { ProductDetailResponseDto } from '../src/products/dto/product-detail-response.dto';

type Stock = { quantity: number; reserved: number };

describe('Products availability PostgreSQL integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fixtureId: string;
  let fixtureName: string;

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
  });

  afterEach(async () => {
    // Cascades remove only this test's options and inventory, never shared seeds.
    if (prisma && fixtureId) {
      await prisma.product.deleteMany({ where: { id: fixtureId } });
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createFixture(isAvailable: boolean, inventory: Stock | null) {
    await prisma.product.create({
      data: {
        id: fixtureId,
        name: fixtureName,
        basePrice: 25000,
        imageUrl: 'https://example.com/task51-coffee.jpg',
        isAvailable,
        ...(inventory ? { inventory: { create: inventory } } : {}),
        options: {
          create: [
            { type: OptionType.TOPPING, name: 'Coffee jelly', extraPrice: 5000 },
            { type: OptionType.SIZE, name: 'Large', extraPrice: 6000 },
            { type: OptionType.SIZE, name: 'Regular', extraPrice: 0 },
          ],
        },
      },
    });
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
    // The list response keeps the catalog shape and does not expose inventory.
    expect(listed).not.toHaveProperty('inventory');
    expect(listed).not.toHaveProperty('options');
    return detail.body as ProductDetailResponseDto;
  }

  it.each([
    { label: 'available stock', isAvailable: true, inventory: { quantity: 8, reserved: 3 }, canOrder: true, stock: 5 },
    { label: 'zero stock', isAvailable: true, inventory: { quantity: 0, reserved: 0 }, canOrder: false, stock: 0 },
    { label: 'fully reserved stock', isAvailable: true, inventory: { quantity: 8, reserved: 8 }, canOrder: false, stock: 0 },
    { label: 'sale disabled', isAvailable: false, inventory: { quantity: 8, reserved: 0 }, canOrder: false, stock: 8 },
    { label: 'missing inventory', isAvailable: true, inventory: null, canOrder: false, stock: null },
  ])('returns consistent state for $label', async ({ isAvailable, inventory, canOrder, stock }) => {
    await createFixture(isAvailable, inventory);
    const detail = await readAllEndpoints(isAvailable, canOrder);

    expect(detail.inventory).toEqual(inventory ? { ...inventory, availableStock: stock } : null);
    expect(detail.basePrice).toBe(25000);
    expect(detail.imageUrl).toBe('https://example.com/task51-coffee.jpg');
    expect(detail.options.map(({ type, name, extraPrice }) => ({ type, name, extraPrice })))
      .toEqual([
        { type: 'SIZE', name: 'Regular', extraPrice: 0 },
        { type: 'SIZE', name: 'Large', extraPrice: 6000 },
        { type: 'TOPPING', name: 'Coffee jelly', extraPrice: 5000 },
      ]);
  });

  it('reflects release of one reserved unit on the next list, search and detail read', async () => {
    await createFixture(true, { quantity: 8, reserved: 8 });
    const before = await readAllEndpoints(true, false);
    expect(before.inventory.availableStock).toBe(0);

    await prisma.inventory.update({
      where: { productId: fixtureId },
      data: { reserved: 7 },
    });

    const after = await readAllEndpoints(true, true);
    expect(after.inventory).toEqual({ quantity: 8, reserved: 7, availableStock: 1 });
  });
});
