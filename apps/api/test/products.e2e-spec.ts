import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Products API (e2e)', () => {
  let app: INestApplication;

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
    it('should return 200 and a non-empty array of products from seed', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(8);

      const first = response.body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('basePrice');
      expect(first).toHaveProperty('imageUrl');
      expect(first).toHaveProperty('isAvailable');
      expect(typeof first.basePrice).toBe('number');
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
      const response = await request(app.getHttpServer())
        .get(`/api/products/${validSeedId}`)
        .expect(200);

      expect(response.body.id).toBe(validSeedId);
      expect(response.body.name).toBe('Cà phê đen đá');
      expect(response.body.basePrice).toBe(25000);
      expect(Array.isArray(response.body.options)).toBe(true);
      expect(response.body.options.length).toBeGreaterThan(0);
      expect(response.body.inventory).toBeDefined();
      expect(response.body.inventory.quantity).toBe(150);
      expect(response.body.inventory.availableStock).toBe(150);
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
