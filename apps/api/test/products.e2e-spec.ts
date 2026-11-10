import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Products API (e2e)', () => {
  let app: INestApplication;

  const seedProductIds = [
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000008',
  ];

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/products', () => {
    it('should return the deterministic seed list using the frontend contract', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(seedProductIds.length);
      expect(response.body.map((product: { id: string }) => product.id)).toEqual(
        expect.arrayContaining(seedProductIds),
      );
      expect(response.body).toContainEqual(
        expect.objectContaining({
          id: 'a0000000-0000-0000-0000-000000000007',
          isAvailable: false,
        }),
      );

      for (const product of response.body) {
        expect(product).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          basePrice: expect.any(Number),
          imageUrl: expect.any(String),
          isAvailable: expect.any(Boolean),
          canOrder: expect.any(Boolean),
          createdAt: expect.any(String),
        });
        expect(Number.isNaN(Date.parse(product.createdAt))).toBe(false);
      }
    });

    it('should perform case-insensitive search (FR-01)', async () => {
      const lowerResponse = await request(app.getHttpServer())
        .get('/api/products')
        .query({ search: 'cà phê' })
        .expect(200);

      const upperResponse = await request(app.getHttpServer())
        .get('/api/products')
        .query({ search: 'CÀ PHÊ' })
        .expect(200);

      expect(lowerResponse.body.length).toBeGreaterThan(0);
      expect(lowerResponse.body.length).toEqual(upperResponse.body.length);
      for (const item of lowerResponse.body) {
        expect(item.name.toLowerCase()).toContain('cà phê');
      }
    });

    it('should return 200 and empty array when search finds no matches', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .query({ search: 'mon_khong_ton_tai_12345' })
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/products/:id', () => {
    const validSeedId = 'a0000000-0000-0000-0000-000000000001';
    const nonExistentUuid = 'a0000000-0000-0000-0000-999999999999';

    it('should return 200 and product detail with options and inventory for valid seed ID', async () => {
      // Seed 'Cà phê đen đá' (a0000000-0000-0000-0000-000000000001):
      // Robusta stock = 40,000g, Size M recipe = 20g -> capacity = 40,000 / 20 = 2000 cups
      const expectedRobustaStock = 40000;
      const sizeMRecipeAmount = 20;
      const expectedRecipeCapacity = Math.floor(expectedRobustaStock / sizeMRecipeAmount);

      const response = await request(app.getHttpServer())
        .get(`/api/products/${validSeedId}`)
        .expect(200);

      expect(response.body).toEqual({
        id: validSeedId,
        name: 'Cà phê đen đá',
        basePrice: 25000,
        imageUrl: expect.any(String),
        isAvailable: true,
        canOrder: true,
        createdAt: expect.any(String),
        options: expect.arrayContaining([
          {
            id: 'b0000000-0000-0000-0000-000000000001',
            type: 'SIZE',
            name: 'Size M (Tiêu chuẩn)',
            extraPrice: 0,
          },
          {
            id: 'b0000000-0000-0000-0000-000000000003',
            type: 'TOPPING',
            name: 'Thạch cà phê',
            extraPrice: 5000,
          },
        ]),
        inventory: {
          quantity: expectedRecipeCapacity,
          reserved: 0,
          availableStock: expectedRecipeCapacity,
        },
      });
      expect(response.body.options).toHaveLength(3);
    });

    it('should return 404 when product id is valid UUID but does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${nonExistentUuid}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 400 when product id is not a valid UUID format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/invalid-uuid-format-123')
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('Validation failed');
    });
  });
});
