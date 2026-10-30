import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CORS Configuration (e2e)', () => {
  let app: INestApplication;
  const targetWebOrigin = 'http://localhost:3006';
  const unauthorizedOrigin = 'http://unauthorized-malicious-site.com';

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

    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3006')
      .split(',')
      .map((origin) => origin.trim());

    // Đảm bảo targetWebOrigin luôn được bao gồm trong test
    if (!allowedOrigins.includes(targetWebOrigin)) {
      allowedOrigins.push(targetWebOrigin);
    }

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should include CORS headers when request comes from allowed origin (http://localhost:3006)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products')
      .set('Origin', targetWebOrigin)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(targetWebOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should respond to preflight OPTIONS request with allowed CORS headers', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/products')
      .set('Origin', targetWebOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .expect((res) => {
        expect([200, 204]).toContain(res.status);
      });

    expect(response.headers['access-control-allow-origin']).toBe(targetWebOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should NOT allow unauthorized origins to receive access-control-allow-origin header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products')
      .set('Origin', unauthorizedOrigin);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
