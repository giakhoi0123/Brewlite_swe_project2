import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OptionType,
  OrderStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { aggregateIngredientRequirements } from './ingredient-requirements';
import { generateOrderNumber } from './order-number';
import {
  calculateItemPrice,
  calculateOrderPricing,
} from './order-pricing';
import { validateOrderSelection } from './order-validation';
import {
  ConcurrentStockConflictException,
  DuplicateProductOptionException,
  IngredientNotFoundException,
  InsufficientIngredientStockException,
  InvalidVoucherException,
  MissingSizeOptionException,
  MultipleSizeOptionsException,
  OptionMissingRecipeException,
  OrderNotFoundException,
  ProductNotFoundException,
  ProductOptionMismatchException,
  ProductOptionNotFoundException,
  ProductUnavailableException,
  UserNotFoundException,
} from './orders.exceptions';
import { OrdersService } from './orders.service';

describe('OrdersService & Pure Helpers Unit Tests (Task 5.1 - Lê Quang Điệp)', () => {
  let service: OrdersService;
  let prismaMock: any;
  let promotionsMock: any;
  let txMock: any;

  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const prodId1 = 'a0000000-0000-0000-0000-000000000001';
  const prodId2 = 'a0000000-0000-0000-0000-000000000002';
  const sizeMId = 'b0000000-0000-0000-0000-000000000001';
  const sizeLId = 'b0000000-0000-0000-0000-000000000002';
  const toppingShotId = 'b0000000-0000-0000-0000-000000000003';
  const ingCoffeeId = 'c0000000-0000-0000-0000-000000000001';
  const ingMilkId = 'c0000000-0000-0000-0000-000000000002';

  beforeEach(async () => {
    txMock = {
      user: {
        findUnique: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      productOption: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      ingredient: {
        updateMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
      },
      orderItem: {
        create: jest.fn(),
      },
      orderItemOption: {
        create: jest.fn(),
      },
      orderInventoryReservation: {
        create: jest.fn(),
      },
      orderReservationLine: {
        create: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };

    prismaMock = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(txMock);
      }),
    };

    promotionsMock = {
      validateAndCalculateDiscount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PromotionsService, useValue: promotionsMock },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ============================================================================
  // NHÓM 1: TÍNH GIÁ AUTHORITATIVE & DECIMAL SAFETY (Yêu cầu 1 -> 9)
  // ============================================================================
  describe('Nhóm 1: Tính giá Authoritative & Decimal Safety', () => {
    it('1. Tính giá từ Product.basePrice', () => {
      const result = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê đen', basePrice: 25000 },
        quantity: 1,
        options: [{ id: sizeMId, name: 'Size M', type: OptionType.SIZE, extraPrice: 0 }],
      });
      expect(result.unitPrice.toString()).toBe('25000');
      expect(result.subtotal.toString()).toBe('25000');
    });

    it('2. Cộng extraPrice của SIZE vào basePrice', () => {
      const result = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê đen', basePrice: 25000 },
        quantity: 1,
        options: [{ id: sizeLId, name: 'Size L', type: OptionType.SIZE, extraPrice: 10000 }],
      });
      expect(result.unitPrice.toString()).toBe('35000');
      expect(result.subtotal.toString()).toBe('35000');
    });

    it('3. Cộng nhiều TOPPING vào đơn giá món', () => {
      const result = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê đen', basePrice: 25000 },
        quantity: 1,
        options: [
          { id: sizeLId, name: 'Size L', type: OptionType.SIZE, extraPrice: 10000 },
          { id: toppingShotId, name: 'Thêm Shot Espresso', type: OptionType.TOPPING, extraPrice: 15000 },
        ],
      });
      expect(result.unitPrice.toString()).toBe('50000');
      expect(result.subtotal.toString()).toBe('50000');
    });

    it('4. Nhân finalUnitPrice theo quantity', () => {
      const result = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê đen', basePrice: 25000 },
        quantity: 3,
        options: [
          { id: sizeLId, name: 'Size L', type: OptionType.SIZE, extraPrice: 5000 },
        ],
      });
      expect(result.unitPrice.toString()).toBe('30000');
      expect(result.subtotal.toString()).toBe('90000');
    });

    it('5. Cộng subtotal của nhiều item trong đơn hàng', () => {
      const item1 = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê đen', basePrice: 30000 },
        quantity: 2,
        options: [{ id: sizeMId, name: 'Size M', type: OptionType.SIZE, extraPrice: 0 }],
      });
      const item2 = calculateItemPrice({
        product: { id: prodId2, name: 'Cà phê sữa', basePrice: 35000 },
        quantity: 1,
        options: [{ id: sizeLId, name: 'Size L', type: OptionType.SIZE, extraPrice: 5000 }],
      });

      const orderPricing = calculateOrderPricing([item1, item2]);
      expect(orderPricing.subtotal.toString()).toBe('100000'); // 60000 + 40000
    });

    it('6. Không dùng giá client gửi (tính hoàn toàn server-side)', () => {
      // Dù client có gửi gì, service chỉ nhận productId và quantity từ DTO
      const item = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê đen', basePrice: new Prisma.Decimal('29000.50') },
        quantity: 2,
        options: [{ id: sizeMId, name: 'Size M', type: OptionType.SIZE, extraPrice: new Prisma.Decimal('0') }],
      });
      expect(item.subtotal.toString()).toBe('58001');
    });

    it('7. Discount âm bị ép về 0', () => {
      const item = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê', basePrice: 50000 },
        quantity: 1,
        options: [{ id: sizeMId, name: 'Size M', type: OptionType.SIZE, extraPrice: 0 }],
      });
      const pricing = calculateOrderPricing([item], new Prisma.Decimal(-10000));
      expect(pricing.discount.toString()).toBe('0');
      expect(pricing.total.toString()).toBe('50000');
    });

    it('8. Discount không vượt quá subtotal (cap discount tại subtotal)', () => {
      const item = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê', basePrice: 50000 },
        quantity: 1,
        options: [{ id: sizeMId, name: 'Size M', type: OptionType.SIZE, extraPrice: 0 }],
      });
      const pricing = calculateOrderPricing([item], new Prisma.Decimal(80000));
      expect(pricing.discount.toString()).toBe('50000');
      expect(pricing.total.toString()).toBe('0');
    });

    it('9. total = subtotal - discount luôn bảo toàn', () => {
      const item = calculateItemPrice({
        product: { id: prodId1, name: 'Cà phê', basePrice: 60000 },
        quantity: 1,
        options: [{ id: sizeMId, name: 'Size M', type: OptionType.SIZE, extraPrice: 0 }],
      });
      const pricing = calculateOrderPricing([item], new Prisma.Decimal(20000));
      expect(pricing.subtotal.toString()).toBe('60000');
      expect(pricing.discount.toString()).toBe('20000');
      expect(pricing.total.toString()).toBe('40000');
    });
  });

  // ============================================================================
  // NHÓM 2: VALIDATION CATALOG & DEFENSE-IN-DEPTH (Yêu cầu 10 -> 18)
  // ============================================================================
  describe('Nhóm 2: Validation Catalog & Defense-in-depth', () => {
    it('10. Product không tồn tại bị từ chối (ProductNotFoundException)', () => {
      const itemDtos = [{ productId: 'non-existent-product', quantity: 1, selectedOptions: [sizeMId] }];
      const productsMap = new Map();
      const optionsMap = new Map();

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        ProductNotFoundException,
      );
    });

    it('11. Product isAvailable = false bị từ chối (ProductUnavailableException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: false }],
      ]);
      const optionsMap = new Map();

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        ProductUnavailableException,
      );
    });

    it('12. Option không tồn tại bị từ chối (ProductOptionNotFoundException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: ['missing-option'] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map();

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        ProductOptionNotFoundException,
      );
    });

    it('13. Option thuộc product khác bị từ chối (ProductOptionMismatchException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map([
        [
          sizeMId,
          {
            id: sizeMId,
            productId: 'other-product-id', // mismatch!
            name: 'Size M',
            type: OptionType.SIZE,
            extraPrice: new Prisma.Decimal(0),
            recipes: [{ id: 'r1', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(20) }],
          },
        ],
      ]);

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        ProductOptionMismatchException,
      );
    });

    it('14. Duplicate option bị từ chối ở service (DuplicateProductOptionException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId, sizeMId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map();

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        DuplicateProductOptionException,
      );
    });

    it('15. Không có SIZE bị từ chối (MissingSizeOptionException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [toppingShotId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map([
        [
          toppingShotId,
          {
            id: toppingShotId,
            productId: prodId1,
            name: 'Topping',
            type: OptionType.TOPPING,
            extraPrice: new Prisma.Decimal(10000),
            recipes: [{ id: 'r1', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(10) }],
          },
        ],
      ]);

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        MissingSizeOptionException,
      );
    });

    it('16. Hai SIZE bị từ chối (MultipleSizeOptionsException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId, sizeLId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map([
        [
          sizeMId,
          {
            id: sizeMId,
            productId: prodId1,
            name: 'Size M',
            type: OptionType.SIZE,
            extraPrice: new Prisma.Decimal(0),
            recipes: [{ id: 'r1', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(20) }],
          },
        ],
        [
          sizeLId,
          {
            id: sizeLId,
            productId: prodId1,
            name: 'Size L',
            type: OptionType.SIZE,
            extraPrice: new Prisma.Decimal(10000),
            recipes: [{ id: 'r2', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(30) }],
          },
        ],
      ]);

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        MultipleSizeOptionsException,
      );
    });

    it('17. TOPPING có thể rỗng (chỉ có duy nhất 1 SIZE là hợp lệ)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map([
        [
          sizeMId,
          {
            id: sizeMId,
            productId: prodId1,
            name: 'Size M',
            type: OptionType.SIZE,
            extraPrice: new Prisma.Decimal(0),
            recipes: [{ id: 'r1', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(20) }],
          },
        ],
      ]);

      const validated = validateOrderSelection(itemDtos, productsMap, optionsMap);
      expect(validated).toHaveLength(1);
      expect(validated[0].options).toHaveLength(1);
      expect(validated[0].options[0].type).toBe(OptionType.SIZE);
    });

    it('18. Option không có recipe bị từ chối (OptionMissingRecipeException)', () => {
      const itemDtos = [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }];
      const productsMap = new Map([
        [prodId1, { id: prodId1, name: 'Trà sen', basePrice: new Prisma.Decimal(30000), isAvailable: true }],
      ]);
      const optionsMap = new Map([
        [
          sizeMId,
          {
            id: sizeMId,
            productId: prodId1,
            name: 'Size M',
            type: OptionType.SIZE,
            extraPrice: new Prisma.Decimal(0),
            recipes: [], // empty recipes!
          },
        ],
      ]);

      expect(() => validateOrderSelection(itemDtos, productsMap, optionsMap)).toThrow(
        OptionMissingRecipeException,
      );
    });
  });

  // ============================================================================
  // NHÓM 3: TỔNG HỢP NGUYÊN LIỆU (Yêu cầu 19 -> 21)
  // ============================================================================
  describe('Nhóm 3: Tổng hợp nguyên liệu', () => {
    it('19. Cộng dồn cùng Ingredient giữa SIZE và TOPPING', () => {
      const items = [
        {
          quantity: 1,
          recipes: [
            { ingredientId: ingCoffeeId, ingredientName: 'Robusta', amount: 20 },
            { ingredientId: ingCoffeeId, ingredientName: 'Robusta', amount: 10 },
          ],
        },
      ];
      const aggregated = aggregateIngredientRequirements(items);
      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].ingredientId).toBe(ingCoffeeId);
      expect(aggregated[0].totalAmount.toString()).toBe('30');
    });

    it('20. Cộng dồn Ingredient giữa nhiều item', () => {
      const items = [
        {
          quantity: 1,
          recipes: [{ ingredientId: ingMilkId, ingredientName: 'Sữa tươi', amount: 100 }],
        },
        {
          quantity: 2,
          recipes: [{ ingredientId: ingMilkId, ingredientName: 'Sữa tươi', amount: 50 }],
        },
      ];
      const aggregated = aggregateIngredientRequirements(items);
      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].totalAmount.toString()).toBe('200'); // 100*1 + 50*2
    });

    it('21. Nhân recipe amount theo quantity của item', () => {
      const items = [
        {
          quantity: 4,
          recipes: [{ ingredientId: ingCoffeeId, ingredientName: 'Robusta', amount: 15 }],
        },
      ];
      const aggregated = aggregateIngredientRequirements(items);
      expect(aggregated[0].totalAmount.toString()).toBe('60');
    });
  });

  // ============================================================================
  // NHÓM 4: TRANSACTION TẠO ĐƠN & KHÓA KHO (Yêu cầu 22 -> 37)
  // ============================================================================
  describe('Nhóm 4: Transaction tạo đơn, Khóa kho và Rollback', () => {
    const validDto: CreateOrderDto = {
      items: [
        {
          productId: prodId1,
          quantity: 2,
          selectedOptions: [sizeMId, toppingShotId],
        },
      ],
      notes: 'Giao nhanh giúp em',
    };

    function setupHappyPathMocks() {
      txMock.user.findUnique.mockResolvedValue({ id: mockUserId });
      txMock.product.findMany.mockResolvedValue([
        { id: prodId1, name: 'Cà phê đen', basePrice: new Prisma.Decimal(25000), isAvailable: true },
      ]);
      txMock.productOption.findMany.mockResolvedValue([
        {
          id: sizeMId,
          productId: prodId1,
          name: 'Size M',
          type: OptionType.SIZE,
          extraPrice: new Prisma.Decimal(0),
          recipes: [
            { id: 'r1', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(20), ingredient: { id: ingCoffeeId, name: 'Robusta' } },
          ],
        },
        {
          id: toppingShotId,
          productId: prodId1,
          name: 'Thêm Shot',
          type: OptionType.TOPPING,
          extraPrice: new Prisma.Decimal(10000),
          recipes: [
            { id: 'r2', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(10), ingredient: { id: ingCoffeeId, name: 'Robusta' } },
          ],
        },
      ]);
      // Mock lock raw query returning stock 100, version 1
      txMock.$queryRaw.mockResolvedValue([
        { id: ingCoffeeId, name: 'Robusta', stock: new Prisma.Decimal('100.000'), version: 1 },
      ]);
      txMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      txMock.order.create.mockResolvedValue({
        id: 'order-uuid-1',
        orderNumber: 'BL-20261108-ABCD1234',
        status: OrderStatus.PENDING,
        subtotal: new Prisma.Decimal(70000),
        discount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(70000),
        createdAt: new Date('2026-11-08T08:00:00Z'),
      });
      txMock.orderItem.create.mockResolvedValue({ id: 'item-uuid-1' });
      txMock.orderItemOption.create.mockResolvedValue({ id: 'opt-row-1' });
      txMock.orderInventoryReservation.create.mockResolvedValue({ id: 'res-uuid-1' });
      txMock.orderReservationLine.create.mockResolvedValue({ id: 'line-uuid-1' });
      txMock.orderStatusHistory.create.mockResolvedValue({ id: 'hist-uuid-1' });
    }

    it('22. Không đủ một Ingredient làm transaction fail (InsufficientIngredientStockException)', async () => {
      setupHappyPathMocks();
      // Yêu cầu: (20 + 10) * 2 = 60. Kho chỉ có 50.
      txMock.$queryRaw.mockResolvedValue([
        { id: ingCoffeeId, name: 'Robusta', stock: new Prisma.Decimal('50.000'), version: 1 },
      ]);

      await expect(service.createOrder(mockUserId, validDto)).rejects.toThrow(
        InsufficientIngredientStockException,
      );
    });

    it('22b. User không tồn tại bị từ chối (UserNotFoundException)', async () => {
      setupHappyPathMocks();
      txMock.user.findUnique.mockResolvedValue(null);

      await expect(service.createOrder('unknown-user-id', validDto)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('22c. Ingredient không tồn tại trong kho bị từ chối (IngredientNotFoundException)', async () => {
      setupHappyPathMocks();
      txMock.$queryRaw.mockResolvedValue([]); // Không tìm thấy dòng ingredient nào

      await expect(service.createOrder(mockUserId, validDto)).rejects.toThrow(
        IngredientNotFoundException,
      );
    });

    it('23. Không cập nhật bất kỳ stock nào nếu một Ingredient thiếu', async () => {
      setupHappyPathMocks();
      txMock.$queryRaw.mockResolvedValue([
        { id: ingCoffeeId, name: 'Robusta', stock: new Prisma.Decimal('50.000'), version: 1 },
      ]);

      await expect(service.createOrder(mockUserId, validDto)).rejects.toThrow();
      expect(txMock.ingredient.updateMany).not.toHaveBeenCalled();
    });

    it('24. Ingredient.stock không âm khi thành công', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: {
          id: ingCoffeeId,
          version: 1,
          stock: { gte: new Prisma.Decimal(60) },
        },
        data: {
          stock: new Prisma.Decimal(40), // 100 - 60 = 40 >= 0
          version: { increment: 1 },
        },
      });
    });

    it('25. Ingredient.version tăng đúng một lần', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.ingredient.updateMany).toHaveBeenCalledTimes(1);
      expect(txMock.ingredient.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: { increment: 1 },
          }),
        }),
      );
    });

    it('26. Update count khác 1 gây concurrency conflict (ConcurrentStockConflictException)', async () => {
      setupHappyPathMocks();
      txMock.ingredient.updateMany.mockResolvedValue({ count: 0 }); // 0 rows updated!

      await expect(service.createOrder(mockUserId, validDto)).rejects.toThrow(
        ConcurrentStockConflictException,
      );
    });

    it('27. Tạo đúng một Reservation cho Order', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.orderInventoryReservation.create).toHaveBeenCalledTimes(1);
      expect(txMock.orderInventoryReservation.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-uuid-1',
          status: ReservationStatus.ACTIVE,
          version: 1,
        },
      });
    });

    it('28. Reservation ở trạng thái ACTIVE', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      const reservationArgs = txMock.orderInventoryReservation.create.mock.calls[0][0];
      expect(reservationArgs.data.status).toBe(ReservationStatus.ACTIVE);
    });

    it('29. ReservationLine có đúng một dòng cho mỗi ingredient', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.orderReservationLine.create).toHaveBeenCalledTimes(1);
    });

    it('30. ReservationLine lưu amount đã cộng gộp', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.orderReservationLine.create).toHaveBeenCalledWith({
        data: {
          reservationId: 'res-uuid-1',
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal(60),
        },
      });
    });

    it('31. StatusHistory null -> PENDING được tạo', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-uuid-1',
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
          actorId: mockUserId,
          reason: 'Order created',
        },
      });
    });

    it('32. actorId trong StatusHistory bằng authenticatedUserId', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      const historyCall = txMock.orderStatusHistory.create.mock.calls[0][0];
      expect(historyCall.data.actorId).toBe(mockUserId);
    });

    it('33. OrderItemOption được tạo từ option DB', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.orderItemOption.create).toHaveBeenCalledTimes(2);
      expect(txMock.orderItemOption.create).toHaveBeenCalledWith({
        data: {
          orderItemId: 'item-uuid-1',
          productOptionId: sizeMId,
          optionNameSnapshot: 'Size M',
          optionType: OptionType.SIZE,
          extraPriceSnapshot: new Prisma.Decimal(0),
        },
      });
    });

    it('34. optionsSnapshot khớp normalized option rows', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      const orderItemArgs = txMock.orderItem.create.mock.calls[0][0];
      const snapshot = orderItemArgs.data.optionsSnapshot;

      expect(snapshot).toHaveLength(2);
      expect(snapshot[0].name).toBe('Size M');
      expect(snapshot[0].type).toBe(OptionType.SIZE);
      expect(snapshot[0].extraPrice).toBe(0);
      expect(snapshot[1].name).toBe('Thêm Shot');
      expect(snapshot[1].type).toBe(OptionType.TOPPING);
      expect(snapshot[1].extraPrice).toBe(10000);
    });

    it('35. Order number không dùng count/max và tuân thủ định dạng BL-YYYYMMDD-<SHORT_UUID>', () => {
      const date = new Date('2026-11-08T12:00:00Z');
      const orderNumber1 = generateOrderNumber(date);
      const orderNumber2 = generateOrderNumber(date);

      expect(orderNumber1).toMatch(/^BL-20261108-[A-F0-9]{8}$/);
      expect(orderNumber2).toMatch(/^BL-20261108-[A-F0-9]{8}$/);
      expect(orderNumber1).not.toBe(orderNumber2); // Entropy đảm bảo tính duy nhất
    });

    it('36. Orders chỉ quản trị tồn kho qua Ingredient và Reservation (tách biệt hoàn toàn khỏi tồn kho thành phẩm)', async () => {
      setupHappyPathMocks();
      await service.createOrder(mockUserId, validDto);

      expect(txMock.$queryRaw).toHaveBeenCalled();
      expect(txMock.ingredient.updateMany).toHaveBeenCalled();
      expect(txMock.orderInventoryReservation.create).toHaveBeenCalled();
      expect(txMock.orderReservationLine.create).toHaveBeenCalled();
    });

    it('37. Lỗi giữa transaction được propagate và rollback', async () => {
      setupHappyPathMocks();
      // Cố tình gây lỗi khi insert Order
      txMock.order.create.mockRejectedValue(new Error('DB failure during order insert'));

      await expect(service.createOrder(mockUserId, validDto)).rejects.toThrow(
        'DB failure during order insert',
      );
      // Khi throw trong $transaction callback, Prisma tự động ROLLBACK toàn bộ transaction
    });
  });

  // ============================================================================
  // NHÓM 5: TÍCH HỢP BOUNDARY VÀ BẢO TOÀN TRẠNG THÁI (Yêu cầu 38 -> 40)
  // ============================================================================
  describe('Nhóm 5: Tích hợp Boundary và bảo toàn trạng thái', () => {
    const validDtoWithVoucher: CreateOrderDto = {
      items: [
        {
          productId: prodId1,
          quantity: 1,
          selectedOptions: [sizeMId],
        },
      ],
      voucherCode: 'WELCOME10',
    };

    function setupVoucherMocks() {
      txMock.user.findUnique.mockResolvedValue({ id: mockUserId });
      txMock.product.findMany.mockResolvedValue([
        { id: prodId1, name: 'Cà phê đen', basePrice: new Prisma.Decimal(30000), isAvailable: true },
      ]);
      txMock.productOption.findMany.mockResolvedValue([
        {
          id: sizeMId,
          productId: prodId1,
          name: 'Size M',
          type: OptionType.SIZE,
          extraPrice: new Prisma.Decimal(0),
          recipes: [
            { id: 'r1', ingredientId: ingCoffeeId, amount: new Prisma.Decimal(20), ingredient: { id: ingCoffeeId, name: 'Robusta' } },
          ],
        },
      ]);
      txMock.$queryRaw.mockResolvedValue([
        { id: ingCoffeeId, name: 'Robusta', stock: new Prisma.Decimal('100.000'), version: 1 },
      ]);
      txMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      txMock.order.create.mockResolvedValue({
        id: 'order-uuid-2',
        orderNumber: 'BL-20261108-XYZ99999',
        status: OrderStatus.PENDING,
        subtotal: new Prisma.Decimal(30000),
        discount: new Prisma.Decimal(10000),
        total: new Prisma.Decimal(20000),
        createdAt: new Date('2026-11-08T08:00:00Z'),
      });
      txMock.orderItem.create.mockResolvedValue({ id: 'item-uuid-2' });
      txMock.orderItemOption.create.mockResolvedValue({ id: 'opt-row-2' });
      txMock.orderInventoryReservation.create.mockResolvedValue({ id: 'res-uuid-2' });
      txMock.orderReservationLine.create.mockResolvedValue({ id: 'line-uuid-2' });
      txMock.orderStatusHistory.create.mockResolvedValue({ id: 'hist-uuid-2' });

      promotionsMock.validateAndCalculateDiscount.mockResolvedValue({
        promotionId: 'promo-uuid-1',
        code: 'WELCOME10',
        discountAmount: 10000,
      });
    }

    it('38. Không cộng loyalty point khi tạo order', async () => {
      setupVoucherMocks();
      await service.createOrder(mockUserId, validDtoWithVoucher);

      // User model không bị gọi update loyaltyPoints
      expect((txMock as any).user.update).toBeUndefined();
    });

    it('39. Không tự chuyển order sang PAID (status luôn là PENDING)', async () => {
      setupVoucherMocks();
      const result = await service.createOrder(mockUserId, validDtoWithVoucher);

      expect(result.status).toBe(OrderStatus.PENDING);
      expect(txMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.PENDING,
          }),
        }),
      );
    });

    it('40. Không tăng promotion usedCount sai thời điểm (chỉ gọi validateAndCalculateDiscount)', async () => {
      setupVoucherMocks();
      await service.createOrder(mockUserId, validDtoWithVoucher);

      expect(promotionsMock.validateAndCalculateDiscount).toHaveBeenCalledTimes(1);
      // Xác nhận không có thao tác update usedCount trên Promotion model
      expect((txMock as any).promotion?.update).toBeUndefined();
    });

    it('40b. Voucher không hợp lệ ném InvalidVoucherException', async () => {
      setupVoucherMocks();
      promotionsMock.validateAndCalculateDiscount.mockRejectedValue(
        new BadRequestException('Mã đã hết hạn'),
      );

      await expect(
        service.createOrder(mockUserId, validDtoWithVoucher),
      ).rejects.toThrow(InvalidVoucherException);
    });

    it('40c. Truyền đúng transaction client tx vào PromotionsService.validateAndCalculateDiscount', async () => {
      setupVoucherMocks();
      await service.createOrder(mockUserId, validDtoWithVoucher);

      expect(promotionsMock.validateAndCalculateDiscount).toHaveBeenCalledWith(
        {
          code: 'WELCOME10',
          orderAmount: 30000,
        },
        txMock,
      );
    });
  });

  describe('getCustomerOrderById & Privacy / IDOR Security', () => {
    const validOrderId = '10000000-0000-4000-8000-000000000001';
    const ownerUserId = '20000000-0000-4000-8000-000000000001';
    const otherUserId = '20000000-0000-4000-8000-000000000002';

    const mockDbOrder = {
      id: validOrderId,
      orderNumber: 'BL-20261110-0001',
      status: OrderStatus.PAID,
      subtotal: new Prisma.Decimal(50000),
      discount: new Prisma.Decimal(5000),
      total: new Prisma.Decimal(45000),
      voucherCode: 'WELCOME10',
      pointsEarned: 4,
      pointsRedeemed: 5,
      notes: 'Giao nhanh',
      createdAt: new Date('2026-11-10T10:00:00Z'),
      updatedAt: new Date('2026-11-10T10:05:00Z'),
      promotion: {
        code: 'WELCOME10',
        description: 'Giảm 10%',
      },
      items: [
        {
          id: 'item-1',
          productId: prodId1,
          productNameSnapshot: 'Cà phê đen',
          unitPriceSnapshot: new Prisma.Decimal(25000),
          quantity: 2,
          subtotal: new Prisma.Decimal(50000),
          notes: null,
          orderItemOptions: [
            {
              id: 'opt-1',
              productOptionId: sizeMId,
              optionNameSnapshot: 'Size M',
              optionType: OptionType.SIZE,
              extraPriceSnapshot: new Prisma.Decimal(0),
            },
          ],
        },
      ],
    };

    it('41. Khách hàng xem đúng đơn của mình thành công và nhận dữ liệu sanitized', async () => {
      prismaMock.order = {
        findFirst: jest.fn().mockResolvedValue(mockDbOrder),
      };

      const result = await service.getCustomerOrderById(validOrderId, ownerUserId);

      expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: validOrderId,
            userId: ownerUserId,
          },
        }),
      );
      expect(result.id).toBe(validOrderId);
      expect(result.orderNumber).toBe('BL-20261110-0001');
      expect(result.total).toBe(45000);
      expect(result.items.length).toBe(1);
    });

    it('42. Khách A xem đơn của Khách B nhận OrderNotFoundException (404)', async () => {
      prismaMock.order = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.getCustomerOrderById(validOrderId, otherUserId),
      ).rejects.toThrow(OrderNotFoundException);
    });

    it('43. Response khách hàng TUYỆT ĐỐI KHÔNG chứa reservation, stock, version nội bộ', async () => {
      prismaMock.order = {
        findFirst: jest.fn().mockResolvedValue(mockDbOrder),
      };

      const result = await service.getCustomerOrderById(validOrderId, ownerUserId);

      expect((result as any).reservation).toBeUndefined();
      expect((result as any).reservationLines).toBeUndefined();
      expect((result as any).lines).toBeUndefined();
      expect((result as any).stock).toBeUndefined();
      expect((result as any).version).toBeUndefined();
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('44. getUserOrderHistory chỉ lấy đơn của authenticated userId và sanitized kho nội bộ', async () => {
      prismaMock.order = {
        findMany: jest.fn().mockResolvedValue([mockDbOrder]),
      };

      const history = await service.getUserOrderHistory(ownerUserId);

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: ownerUserId },
        }),
      );
      expect(history.length).toBe(1);
      expect((history[0] as any).reservation).toBeUndefined();
      expect((history[0] as any).lines).toBeUndefined();
    });
  });

  describe('Loyalty Points Atomicity & Concurrency Guards', () => {
    function setupBaseMocks(userLoyaltyPoints: number = 100) {
      txMock.user.findUnique.mockResolvedValue({
        id: mockUserId,
        loyaltyPoints: userLoyaltyPoints,
      });
      txMock.user.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      txMock.loyaltyLog = { create: jest.fn().mockResolvedValue({ id: 'log-1' }) };

      txMock.product.findMany.mockResolvedValue([
        { id: prodId1, name: 'Cà phê đen', basePrice: new Prisma.Decimal(30000), isAvailable: true },
      ]);
      txMock.productOption.findMany.mockResolvedValue([
        {
          id: sizeMId,
          productId: prodId1,
          name: 'Size M',
          type: OptionType.SIZE,
          extraPrice: new Prisma.Decimal(0),
          recipes: [
            {
              ingredientId: ingCoffeeId,
              amount: new Prisma.Decimal('10.000'),
              ingredient: { id: ingCoffeeId, name: 'Robusta' },
            },
          ],
        },
      ]);
      txMock.$queryRaw.mockResolvedValue([
        { id: ingCoffeeId, name: 'Robusta', stock: new Prisma.Decimal('100.000'), version: 1 },
      ]);
      txMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      txMock.order.create.mockResolvedValue({
        id: 'order-uuid-loyalty',
        orderNumber: 'BL-20261110-LOYALTY',
        status: OrderStatus.PENDING,
        subtotal: new Prisma.Decimal(30000),
        discount: new Prisma.Decimal(10000),
        total: new Prisma.Decimal(20000),
        createdAt: new Date('2026-11-10T10:00:00Z'),
      });
      txMock.orderItem.create.mockResolvedValue({ id: 'item-1' });
      txMock.orderItemOption.create.mockResolvedValue({ id: 'opt-1' });
      txMock.orderInventoryReservation.create.mockResolvedValue({ id: 'res-1' });
      txMock.orderReservationLine.create.mockResolvedValue({ id: 'line-1' });
      txMock.orderStatusHistory.create.mockResolvedValue({ id: 'hist-1' });
    }

    it('45. Tạo đơn với pointsToRedeem hợp lệ: thực hiện atomic updateMany và ghi loyaltyLog', async () => {
      setupBaseMocks(100);
      const dto: CreateOrderDto = {
        items: [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }],
        pointsToRedeem: 10, // 10 điểm = 10.000 VNĐ
      };

      await service.createOrder(mockUserId, dto);

      expect(txMock.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockUserId,
          loyaltyPoints: { gte: 10 },
        },
        data: {
          loyaltyPoints: { decrement: 10 },
        },
      });
      expect(txMock.loyaltyLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          points: -10,
        }),
      });
    });

    it('46. pointsToRedeem vượt quá số dư hiện có: ném BadRequestException ngay lập tức', async () => {
      setupBaseMocks(5); // Chỉ có 5 điểm
      const dto: CreateOrderDto = {
        items: [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }],
        pointsToRedeem: 10,
      };

      await expect(service.createOrder(mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(txMock.user.updateMany).not.toHaveBeenCalled();
    });

    it('47. Concurrent race condition: updateMany count === 0 ném BadRequestException', async () => {
      setupBaseMocks(50);
      txMock.user.updateMany.mockResolvedValue({ count: 0 }); // Simulating race where balance changed
      const dto: CreateOrderDto = {
        items: [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }],
        pointsToRedeem: 20,
      };

      await expect(service.createOrder(mockUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('48. pointsToRedeem vượt quá giá trị đơn hàng: tự động clamp không làm total âm', async () => {
      setupBaseMocks(500); // 500 điểm = 500.000 VNĐ trong khi đơn chỉ 30.000 VNĐ
      const dto: CreateOrderDto = {
        items: [{ productId: prodId1, quantity: 1, selectedOptions: [sizeMId] }],
        pointsToRedeem: 100, // Đòi đổi 100.000 VNĐ
      };

      await service.createOrder(mockUserId, dto);

      // maxPointsCanUse = 30000 / 1000 = 30 điểm
      expect(txMock.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockUserId,
          loyaltyPoints: { gte: 30 },
        },
        data: {
          loyaltyPoints: { decrement: 30 },
        },
      });
    });
  });
});
