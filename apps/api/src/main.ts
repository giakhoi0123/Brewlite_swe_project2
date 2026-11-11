import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3006')
    .split(',')
    .map((origin) => origin.trim());
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'Accept',
    'Idempotency-Key',
  ];
  if (process.env.NODE_ENV !== 'production') {
    allowedHeaders.push('X-Mock-Payment-Scenario');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (server-to-server, curl, same-origin)
      // hoặc origin nằm trong danh sách whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders,
  });

  const port = process.env.PORT || 3005;
  await app.listen(port);
  logger.log(`🚀 BrewLite API is running on: http://localhost:${port}/api`);
  logger.log(`🔒 CORS whitelist: ${allowedOrigins.join(', ')}`);
}

bootstrap();
