import { ValidationPipe } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  POSTGRES_UUID_REGEX,
  UpdateOrderStatusDto,
} from './index';

describe('Orders DTO & Validation (Unit Tests - Pure Logic)', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
  });

  const validSeedProductId = 'a0000000-0000-0000-0000-000000000001';
  const validSeedOptionId1 = 'b0000000-0000-0000-0000-000000000001';
  const validSeedOptionId2 = 'b0000000-0000-0000-0000-000000000002';
  const validStandardUuid = '10000000-0000-4000-8000-000000000001';

  describe('CreateOrderItemDto', () => {
    it('accepts valid item with seed UUID and options', async () => {
      const dto = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 2,
        selectedOptions: [validSeedOptionId1, validSeedOptionId2],
        notes: '  ít đường  ',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts standard RFC-4122 v4 UUID', async () => {
      const dto = plainToInstance(CreateOrderItemDto, {
        productId: validStandardUuid,
        quantity: 1,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('10. rejects quantity = 0, negative, or decimal values', async () => {
      const zeroQty = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 0,
      });
      const negQty = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: -1,
      });
      const decimalQty = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 1.5,
      });

      const errsZero = await validate(zeroQty);
      expect(errsZero.length).toBeGreaterThan(0);
      expect(errsZero[0].property).toBe('quantity');

      const errsNeg = await validate(negQty);
      expect(errsNeg.length).toBeGreaterThan(0);
      expect(errsNeg[0].property).toBe('quantity');

      const errsDec = await validate(decimalQty);
      expect(errsDec.length).toBeGreaterThan(0);
      expect(errsDec[0].property).toBe('quantity');
    });

    it('11. rejects invalid UUID strings', async () => {
      const invalidProduct = plainToInstance(CreateOrderItemDto, {
        productId: 'not-a-uuid-at-all',
        quantity: 1,
      });
      const errsProduct = await validate(invalidProduct);
      expect(errsProduct.length).toBeGreaterThan(0);
      expect(errsProduct[0].property).toBe('productId');

      const invalidOption = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 1,
        selectedOptions: ['bad-option-id'],
      });
      const errsOption = await validate(invalidOption);
      expect(errsOption.length).toBeGreaterThan(0);
      expect(errsOption[0].property).toBe('selectedOptions');
    });

    it('12. rejects duplicate selectedOptions in the same item', async () => {
      const duplicateOptionDto = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 1,
        selectedOptions: [validSeedOptionId1, validSeedOptionId1],
      });

      const errors = await validate(duplicateOptionDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('selectedOptions');
      expect(errors[0].constraints?.isNoDuplicateOptions).toBeDefined();
    });

    it('13. accepts omitted or empty selectedOptions', async () => {
      const omittedOptionsDto = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 1,
      });
      const emptyOptionsDto = plainToInstance(CreateOrderItemDto, {
        productId: validSeedProductId,
        quantity: 1,
        selectedOptions: [],
      });

      expect(await validate(omittedOptionsDto)).toHaveLength(0);
      expect(await validate(emptyOptionsDto)).toHaveLength(0);
    });
  });

  describe('CreateOrderDto', () => {
    it('9. rejects empty items array', async () => {
      const emptyItemsDto = plainToInstance(CreateOrderDto, {
        items: [],
      });

      const errors = await validate(emptyItemsDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('items');
    });

    it('validates nested items with full validation', async () => {
      const orderDto = plainToInstance(CreateOrderDto, {
        items: [
          {
            productId: validSeedProductId,
            quantity: 1,
            selectedOptions: [validSeedOptionId1],
          },
          {
            productId: validSeedProductId,
            quantity: 0, // invalid quantity!
          },
        ],
      });

      const errors = await validate(orderDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('items');
    });

    it('14. strips disallowed fields (price, userId, status, subtotal, discount, total) via ValidationPipe', async () => {
      const rawPayload = {
        userId: 'c0000000-0000-0000-0000-000000000001',
        status: 'PAID',
        price: 5000,
        subtotal: 10000,
        discount: 2000,
        total: 8000,
        orderNumber: 'ORD-HACK-001',
        version: 99,
        items: [
          {
            productId: validSeedProductId,
            quantity: 2,
            unitPrice: 1000,
            subtotal: 2000,
          },
        ],
        voucherCode: '  brew20  ',
        notes: '  chờ shipper  ',
      };

      const transformed = (await validationPipe.transform(rawPayload, {
        type: 'body',
        metatype: CreateOrderDto,
      })) as CreateOrderDto;

      expect(transformed).toBeInstanceOf(CreateOrderDto);
      expect((transformed as any).userId).toBeUndefined();
      expect((transformed as any).status).toBeUndefined();
      expect((transformed as any).price).toBeUndefined();
      expect((transformed as any).subtotal).toBeUndefined();
      expect((transformed as any).discount).toBeUndefined();
      expect((transformed as any).total).toBeUndefined();
      expect((transformed as any).orderNumber).toBeUndefined();
      expect((transformed as any).version).toBeUndefined();

      expect((transformed.items[0] as any).unitPrice).toBeUndefined();
      expect((transformed.items[0] as any).subtotal).toBeUndefined();

      expect(transformed.items[0].productId).toBe(validSeedProductId);
      expect(transformed.items[0].quantity).toBe(2);
      expect(transformed.voucherCode).toBe('BREW20');
      expect(transformed.notes).toBe('chờ shipper');
    });
  });

  describe('UpdateOrderStatusDto', () => {
    it('accepts valid OrderStatus enum value', async () => {
      const validDto = plainToInstance(UpdateOrderStatusDto, {
        status: OrderStatus.PREPARING,
        reason: 'Barista bắt đầu pha chế',
      });

      const errors = await validate(validDto);
      expect(errors).toHaveLength(0);
    });

    it('15. rejects invalid status not belonging to OrderStatus enum', async () => {
      const invalidDto = plainToInstance(UpdateOrderStatusDto, {
        status: 'INVALID_STATUS',
      });

      const errors = await validate(invalidDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('status');
    });

    it('strips actorId sent from client body via ValidationPipe', async () => {
      const rawPayload = {
        status: OrderStatus.READY,
        actorId: 'c0000000-0000-0000-0000-000000000002',
        reason: 'Đã làm xong',
      };

      const transformed = (await validationPipe.transform(rawPayload, {
        type: 'body',
        metatype: UpdateOrderStatusDto,
      })) as UpdateOrderStatusDto;

      expect(transformed.status).toBe(OrderStatus.READY);
      expect((transformed as any).actorId).toBeUndefined();
    });
  });

  describe('POSTGRES_UUID_REGEX format check', () => {
    it('verifies regex compatibility across UUID formats', () => {
      expect(POSTGRES_UUID_REGEX.test(validSeedProductId)).toBe(true);
      expect(POSTGRES_UUID_REGEX.test(validSeedOptionId1)).toBe(true);
      expect(POSTGRES_UUID_REGEX.test(validStandardUuid)).toBe(true);
      expect(
        POSTGRES_UUID_REGEX.test('00000000-0000-0000-0000-000000000000'),
      ).toBe(true);
      expect(POSTGRES_UUID_REGEX.test('invalid')).toBe(false);
      expect(
        POSTGRES_UUID_REGEX.test('g0000000-0000-0000-0000-000000000001'),
      ).toBe(false);
    });
  });
});
