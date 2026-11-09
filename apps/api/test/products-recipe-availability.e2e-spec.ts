import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import guardIntegrationDatabase from './integration-test-guard';

describe('Products Recipe Availability API (PostgreSQL Integration e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Seed fixture IDs
  const seedBlackCoffeeId = 'a0000000-0000-0000-0000-000000000001';
  const sizeMBlackCoffeeId = 'b0000000-0000-0000-0000-000000000001';
  const sizeLBlackCoffeeId = 'b0000000-0000-0000-0000-000000000002';
  const toppingCoffeeJellyId = 'b0000000-0000-0000-0000-000000000003';

  const seedBacXiuId = 'a0000000-0000-0000-0000-000000000003';
  const sizeMBacXiuId = 'b0000000-0000-0000-0000-000000000007';
  const sizeLBacXiuId = 'b0000000-0000-0000-0000-000000000008';
  const toppingShotEspressoId = 'b0000000-0000-0000-0000-000000000009';

  const seedColdBrewDisabledId = 'a0000000-0000-0000-0000-000000000007';
  const sizeMColdBrewId = 'b0000000-0000-0000-0000-000000000020';

  beforeAll(async () => {
    guardIntegrationDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('A. Seed UUID version 0 and Public Access', () => {
    it('successfully calls POST /api/products/:id/availability with version 0 seed IDs without auth token', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({
          selectedOptions: [sizeMBlackCoffeeId],
        })
        .expect(200);

      expect(response.body).toEqual({
        productId: seedBlackCoffeeId,
        availableStock: 2000,
        canOrder: true,
      });
    });
  });

  describe('B. SIZE M vs SIZE L Capacities from Seed Recipes', () => {
    it('returns 2000 for Size M (50000g / 25g) and 1428 for Size L (50000g / 35g)', async () => {
      const resM = await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({ selectedOptions: [sizeMBlackCoffeeId] })
        .expect(200);

      const resL = await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({ selectedOptions: [sizeLBlackCoffeeId] })
        .expect(200);

      expect(resM.body.availableStock).toBe(2000);
      expect(resL.body.availableStock).toBe(1428);
      expect(resL.body.availableStock).toBeLessThan(resM.body.availableStock);
    });
  });

  describe('C. SIZE + TOPPING Sharing Ingredient', () => {
    it('sums Robusta amounts when Bạc xỉu Size M (15g) and Shot Espresso (15g) are ordered together', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/products/${seedBacXiuId}/availability`)
        .send({ selectedOptions: [sizeMBacXiuId, toppingShotEspressoId] })
        .expect(200);

      // Sữa tươi is bottleneck: 40000ml / 80ml = 500
      expect(response.body.availableStock).toBe(500);
      expect(response.body.canOrder).toBe(true);
    });
  });

  describe('D. TOPPING Using Different Ingredient (Bottleneck Detection)', () => {
    it('properly drops capacity when Topping ingredient is scarcer than Size ingredient', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({ selectedOptions: [sizeMBlackCoffeeId, toppingCoffeeJellyId] })
        .expect(200);

      // Thạch cà phê stock = 8000g, required = 40g -> 8000 / 40 = 200 (bottleneck vs Robusta 2000)
      expect(response.body.availableStock).toBe(200);
      expect(response.body.canOrder).toBe(true);
    });
  });

  describe('E. Product isAvailable = false', () => {
    it('returns canOrder = false when product.isAvailable is false', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/products/${seedColdBrewDisabledId}/availability`)
        .send({ selectedOptions: [sizeMColdBrewId] })
        .expect(200);

      expect(response.body.productId).toBe(seedColdBrewDisabledId);
      expect(response.body.availableStock).toBe(0); // Arabica stock is 0
      expect(response.body.canOrder).toBe(false);
    });
  });

  describe('F. Product Not Found', () => {
    it('returns 404 when product ID does not exist', async () => {
      await request(app.getHttpServer())
        .post('/api/products/a0000000-0000-0000-0000-999999999999/availability')
        .send({ selectedOptions: [sizeMBlackCoffeeId] })
        .expect(404);
    });
  });

  describe('G. Option Not Belonging to Product', () => {
    it('returns 400 when an option belongs to another product', async () => {
      await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({
          // sizeMBacXiuId belongs to Bạc xỉu, not Cà phê đen
          selectedOptions: [sizeMBlackCoffeeId, sizeMBacXiuId],
        })
        .expect(400);
    });
  });

  describe('H. Duplicate Option IDs in Request', () => {
    it('returns 400 when duplicate options are submitted', async () => {
      await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({
          selectedOptions: [sizeMBlackCoffeeId, sizeMBlackCoffeeId],
        })
        .expect(400);
    });
  });

  describe('I. Missing or Multiple SIZE Options', () => {
    it('returns 400 when no SIZE option is provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({
          selectedOptions: [toppingCoffeeJellyId],
        })
        .expect(400);
    });

    it('returns 400 when two SIZE options are provided', async () => {
      await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({
          selectedOptions: [sizeMBlackCoffeeId, sizeLBlackCoffeeId],
        })
        .expect(400);
    });
  });

  describe('J. Database State Preservation (Read-Only Guarantee)', () => {
    it('does not mutate ingredient stock, inventories, orders, or any other tables', async () => {
      // 1. Snapshot database state before
      const [
        ingredientsBefore,
        inventoriesBefore,
        ordersBefore,
        orderItemsBefore,
      ] = await Promise.all([
        prisma.ingredient.findMany({ orderBy: { id: 'asc' } }),
        prisma.inventory.findMany({ orderBy: { id: 'asc' } }),
        prisma.order.count(),
        prisma.orderItem.count(),
      ]);

      // 2. Call the endpoint multiple times with diverse requests
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post(`/api/products/${seedBlackCoffeeId}/availability`)
          .send({ selectedOptions: [sizeMBlackCoffeeId, toppingCoffeeJellyId] })
          .expect(200);

        await request(app.getHttpServer())
          .post(`/api/products/${seedBacXiuId}/availability`)
          .send({ selectedOptions: [sizeLBacXiuId] })
          .expect(200);
      }

      // 3. Snapshot database state after
      const [
        ingredientsAfter,
        inventoriesAfter,
        ordersAfter,
        orderItemsAfter,
      ] = await Promise.all([
        prisma.ingredient.findMany({ orderBy: { id: 'asc' } }),
        prisma.inventory.findMany({ orderBy: { id: 'asc' } }),
        prisma.order.count(),
        prisma.orderItem.count(),
      ]);

      // 4. Assert strict immutability
      expect(ingredientsAfter).toEqual(ingredientsBefore);
      expect(inventoriesAfter).toEqual(inventoriesBefore);
      expect(ordersAfter).toBe(ordersBefore);
      expect(orderItemsAfter).toBe(orderItemsBefore);
    });
  });

  describe('K. Protection Against Client Manipulation and Extra Payload Fields', () => {
    it('ignores client injected stock, price, userId, and availableStock fields', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/products/${seedBlackCoffeeId}/availability`)
        .send({
          selectedOptions: [sizeMBlackCoffeeId],
          stock: 999999,
          availableStock: 999999,
          price: 1,
          userId: '00000000-0000-0000-0000-000000000000',
          canOrder: false,
        })
        .expect(200);

      // Server calculates actual value (2000), client spoofed value is completely ignored
      expect(response.body).toEqual({
        productId: seedBlackCoffeeId,
        availableStock: 2000,
        canOrder: true,
      });
      expect(response.body).not.toHaveProperty('stock');
      expect(response.body).not.toHaveProperty('price');
      expect(response.body).not.toHaveProperty('userId');
    });
  });

  describe('L. Legacy Endpoints Contract Integrity', () => {
    it('preserves GET /api/products response shape without modification', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      const first = response.body[0];
      expect(first).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        basePrice: expect.any(Number),
        imageUrl: expect.any(String),
        isAvailable: expect.any(Boolean),
        canOrder: expect.any(Boolean),
        createdAt: expect.any(String),
      });
      expect(first).not.toHaveProperty('inventory');
    });

    it('preserves GET /api/products/:id response shape with options and legacy inventory', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${seedBlackCoffeeId}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: seedBlackCoffeeId,
          name: 'Cà phê đen đá',
          basePrice: 25000,
          imageUrl: expect.any(String),
          isAvailable: true,
          canOrder: true,
          options: expect.any(Array),
          inventory: {
            quantity: 150,
            reserved: 0,
            availableStock: 150,
          },
        }),
      );
    });
  });
});
