import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Sprint 1 Menu MVP Live Flow Verification', () => {
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

  it('Verifies Live Database Seed -> NestJS Products API -> Frontend Contract Compatibility', async () => {
    // 1. Fetch list of products
    const listRes = await request(app.getHttpServer())
      .get('/api/products')
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(8);

    // Verify properties match Frontend Product type
    for (const item of listRes.body) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(typeof item.basePrice).toBe('number');
      expect(typeof item.imageUrl).toBe('string');
      expect(typeof item.isAvailable).toBe('boolean');
      expect(item.basePrice).toBeGreaterThan(0);
    }

    // 2. Fetch specific item (Cold brew cam sả - unavailable test item)
    const unavailableItem = listRes.body.find((p: any) => p.name.includes('Cold Brew Cam Sả'));
    expect(unavailableItem).toBeDefined();
    expect(unavailableItem.isAvailable).toBe(false);

    // 3. Fetch item detail (Cà phê trứng nướng - with options and inventory)
    const trungNuongItem = listRes.body.find((p: any) => p.name.includes('Trứng Nướng'));
    expect(trungNuongItem).toBeDefined();

    const detailRes = await request(app.getHttpServer())
      .get(`/api/products/${trungNuongItem.id}`)
      .expect(200);

    expect(detailRes.body.id).toBe(trungNuongItem.id);
    expect(detailRes.body.name).toBe(trungNuongItem.name);
    expect(Array.isArray(detailRes.body.options)).toBe(true);
    expect(detailRes.body.options.length).toBeGreaterThan(0);

    // Verify options format
    const cheeseOption = detailRes.body.options.find((opt: any) => opt.name.includes('Kem Cheese'));
    expect(cheeseOption).toBeDefined();
    expect(cheeseOption.type).toBe('TOPPING');
    expect(cheeseOption.extraPrice).toBe(12000);

    // Verify inventory format
    expect(detailRes.body.inventory).toBeDefined();
    expect(detailRes.body.inventory.quantity).toBe(75);
    expect(detailRes.body.inventory.availableStock).toBe(75);
  });
});
