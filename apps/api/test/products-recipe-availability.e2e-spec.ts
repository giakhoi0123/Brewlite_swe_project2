import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OptionType, IngredientUnit, Prisma } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import guardIntegrationDatabase from './integration-test-guard';

describe('Products Recipe-Based Availability E2E Canonical (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Deterministic UUIDs for the suite fixtures
  const ingCoffeeId = 'f0000000-0000-4000-8000-000000000001';
  const ingMilkId = 'f0000000-0000-4000-8000-000000000002';

  const productValidId = 'e0000000-0000-4000-8000-000000000001';
  const productDisabledId = 'e0000000-0000-4000-8000-000000000002';
  const product2Id = 'e0000000-0000-4000-8000-000000000003';
  const foreignProductId = 'e0000000-0000-4000-8000-000000000004';

  const sizeMId = 'd0000000-0000-4000-8000-000000000001';
  const sizeLId = 'd0000000-0000-4000-8000-000000000002';
  const sizeNoRecipeId = 'd0000000-0000-4000-8000-000000000003';
  const toppingEspressoId = 'd0000000-0000-4000-8000-000000000004';
  const toppingJellyId = 'd0000000-0000-4000-8000-000000000005';

  const sizeDisabledId = 'd0000000-0000-4000-8000-000000000006';
  const sizeM2Id = 'd0000000-0000-4000-8000-000000000007';
  const foreignSizeId = 'd0000000-0000-4000-8000-000000000008';

  const allProductIds = [productValidId, productDisabledId, product2Id, foreignProductId];
  const allOptionIds = [
    sizeMId,
    sizeLId,
    sizeNoRecipeId,
    toppingEspressoId,
    toppingJellyId,
    sizeDisabledId,
    sizeM2Id,
    foreignSizeId,
  ];
  const allIngredientIds = [ingCoffeeId, ingMilkId];

  async function cleanupFixtures() {
    if (!prisma) return;
    try {
      await prisma.optionRecipe.deleteMany({
        where: {
          productOptionId: { in: allOptionIds },
        },
      });
      await prisma.productOption.deleteMany({
        where: {
          id: { in: allOptionIds },
        },
      });
      await prisma.product.deleteMany({
        where: {
          id: { in: allProductIds },
        },
      });
      await prisma.ingredient.deleteMany({
        where: {
          id: { in: allIngredientIds },
        },
      });
    } catch {
      // Ignore if table/records not found during initial clean
    }
  }

  beforeAll(async () => {
    guardIntegrationDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Clean any remnants before seeding
    await cleanupFixtures();

    // 1. Ingredients
    // Coffee: stock 300g
    // Milk: stock 1000ml
    await prisma.ingredient.createMany({
      data: [
        {
          id: ingCoffeeId,
          name: 'E2E Recipe Test Cà phê hạt',
          unit: IngredientUnit.G,
          stock: new Prisma.Decimal('300.000'),
          version: 1,
        },
        {
          id: ingMilkId,
          name: 'E2E Recipe Test Sữa đặc',
          unit: IngredientUnit.ML,
          stock: new Prisma.Decimal('1000.000'),
          version: 1,
        },
      ],
    });

    // 2. Products
    await prisma.product.createMany({
      data: [
        {
          id: productValidId,
          name: 'E2E Cà phê sữa tươi',
          basePrice: new Prisma.Decimal('29000.00'),
          imageUrl: 'https://example.com/cf-sua.jpg',
          isAvailable: true,
        },
        {
          id: productDisabledId,
          name: 'E2E Cà phê tạm ngừng bán',
          basePrice: new Prisma.Decimal('35000.00'),
          imageUrl: 'https://example.com/cf-disabled.jpg',
          isAvailable: false,
        },
        {
          id: product2Id,
          name: 'E2E Cà phê đen thứ hai',
          basePrice: new Prisma.Decimal('25000.00'),
          imageUrl: 'https://example.com/cf-den-2.jpg',
          isAvailable: true,
        },
        {
          id: foreignProductId,
          name: 'E2E Sản phẩm ngoại lai',
          basePrice: new Prisma.Decimal('40000.00'),
          imageUrl: 'https://example.com/foreign.jpg',
          isAvailable: true,
        },
      ],
    });

    // 3. Options
    await prisma.productOption.createMany({
      data: [
        // productValid options
        {
          id: sizeMId,
          productId: productValidId,
          type: OptionType.SIZE,
          name: 'Size M',
          extraPrice: new Prisma.Decimal('0.00'),
        },
        {
          id: sizeLId,
          productId: productValidId,
          type: OptionType.SIZE,
          name: 'Size L',
          extraPrice: new Prisma.Decimal('6000.00'),
        },
        {
          id: sizeNoRecipeId,
          productId: productValidId,
          type: OptionType.SIZE,
          name: 'Size Không Công Thức',
          extraPrice: new Prisma.Decimal('0.00'),
        },
        {
          id: toppingEspressoId,
          productId: productValidId,
          type: OptionType.TOPPING,
          name: 'Thêm Shot Espresso',
          extraPrice: new Prisma.Decimal('10000.00'),
        },
        {
          id: toppingJellyId,
          productId: productValidId,
          type: OptionType.TOPPING,
          name: 'Thạch cà phê',
          extraPrice: new Prisma.Decimal('8000.00'),
        },

        // productDisabled options
        {
          id: sizeDisabledId,
          productId: productDisabledId,
          type: OptionType.SIZE,
          name: 'Size Vừa Disabled',
          extraPrice: new Prisma.Decimal('0.00'),
        },

        // product2 options
        {
          id: sizeM2Id,
          productId: product2Id,
          type: OptionType.SIZE,
          name: 'Size M2',
          extraPrice: new Prisma.Decimal('0.00'),
        },

        // foreignProduct options
        {
          id: foreignSizeId,
          productId: foreignProductId,
          type: OptionType.SIZE,
          name: 'Size Ngoại Lai',
          extraPrice: new Prisma.Decimal('0.00'),
        },
      ],
    });

    // 4. Option Recipes
    // Size M productValid: 20g cà phê, 40ml sữa -> (300/20 = 15; 1000/40 = 25) => Capacity = 15
    // Size L productValid: 30g cà phê, 60ml sữa -> (300/30 = 10; 1000/60 = 16) => Capacity = 10
    // Topping Espresso: 10g cà phê
    // Topping Jelly: 5g cà phê
    // Size Disabled: 20g cà phê
    // Size M2 product2: 20g cà phê
    await prisma.optionRecipe.createMany({
      data: [
        {
          productOptionId: sizeMId,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('20.000'),
        },
        {
          productOptionId: sizeMId,
          ingredientId: ingMilkId,
          amount: new Prisma.Decimal('40.000'),
        },
        {
          productOptionId: sizeLId,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('30.000'),
        },
        {
          productOptionId: sizeLId,
          ingredientId: ingMilkId,
          amount: new Prisma.Decimal('60.000'),
        },
        {
          productOptionId: toppingEspressoId,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('10.000'),
        },
        {
          productOptionId: toppingJellyId,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('5.000'),
        },
        {
          productOptionId: sizeDisabledId,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('20.000'),
        },
        {
          productOptionId: sizeM2Id,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('20.000'),
        },
        {
          productOptionId: foreignSizeId,
          ingredientId: ingCoffeeId,
          amount: new Prisma.Decimal('20.000'),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupFixtures();
    await app.close();
  });

  // A. Một dòng hợp lệ
  it('A. [Một dòng hợp lệ] trả về HTTP 201, canOrder = true, item index 0 và availableQuantity bằng bottleneck', async () => {
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [],
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body).toEqual({
      canOrder: true,
      items: [
        {
          index: 0,
          productId: productValidId,
          sizeId: sizeMId,
          requestedQuantity: 1,
          availableQuantity: 15, // 300g / 20g = 15; 1000ml / 40ml = 25 -> bottleneck = 15
          canOrder: true,
        },
      ],
    });
  });

  // B. SIZE và TOPPING dùng chung nguyên liệu
  it('B. [SIZE + TOPPING dùng chung nguyên liệu] cộng gộp định lượng trước khi chia tồn kho', async () => {
    // sizeM (20g cà phê) + toppingEspresso (10g cà phê) = 30g cà phê
    // Stock cà phê: 300g => 300 / 30 = 10 ly
    // Sữa: 40ml => 1000 / 40 = 25 ly
    // Bottleneck = 10 ly
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [toppingEspressoId],
          quantity: 2,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body.canOrder).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual({
      index: 0,
      productId: productValidId,
      sizeId: sizeMId,
      requestedQuantity: 2,
      availableQuantity: 10,
      canOrder: true,
    });
  });

  // C. Nhiều dòng dùng chung nguyên liệu
  it('C. [Nhiều dòng dùng chung nguyên liệu] xét tổng demand toàn cart và không oversell', async () => {
    // Dòng 0: productValid, sizeM (20g cà phê), quantity: 10 => tiêu thụ 200g
    // Dòng 1: product2, sizeM2 (20g cà phê), quantity: 5 => tiêu thụ 100g
    // Tổng cà phê: 200 + 100 = 300g (vừa đủ stock)
    // Dòng 0 available: sau khi dòng 1 chiếm 100g -> còn 200g / 20g = 10 ly
    // Dòng 1 available: sau khi dòng 0 chiếm 200g -> còn 100g / 20g = 5 ly
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [],
          quantity: 10,
        },
        {
          productId: product2Id,
          sizeId: sizeM2Id,
          toppingIds: [],
          quantity: 5,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body.canOrder).toBe(true);
    expect(res.body.items).toEqual([
      {
        index: 0,
        productId: productValidId,
        sizeId: sizeMId,
        requestedQuantity: 10,
        availableQuantity: 10,
        canOrder: true,
      },
      {
        index: 1,
        productId: product2Id,
        sizeId: sizeM2Id,
        requestedQuantity: 5,
        availableQuantity: 5,
        canOrder: true,
      },
    ]);
  });

  // D. Quantity vượt capacity
  it('D. [Quantity vượt capacity] trả canOrder = false và giữ nguyên availableQuantity thực tế', async () => {
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [],
          quantity: 16, // Capacity chỉ là 15
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body.canOrder).toBe(false);
    expect(res.body.items[0]).toEqual({
      index: 0,
      productId: productValidId,
      sizeId: sizeMId,
      requestedQuantity: 16,
      availableQuantity: 15,
      canOrder: false,
    });
  });

  // E. Derived remaining bằng 0
  it('E. [Derived remaining bằng 0] khi các dòng khác dùng hết stock: availableQuantity = 0, canOrder = false, không 500', async () => {
    // Dòng 0 yêu cầu 15 ly (15 * 20g = 300g, hết sạch cà phê)
    // Dòng 1 (cần 20g cà phê) còn 0g -> capacity = 0
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [],
          quantity: 15,
        },
        {
          productId: product2Id,
          sizeId: sizeM2Id,
          toppingIds: [],
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body.canOrder).toBe(false);
    expect(res.body.items).toEqual([
      {
        index: 0,
        productId: productValidId,
        sizeId: sizeMId,
        requestedQuantity: 15,
        availableQuantity: 14, // 300g stock - 20g (Line 1 demand) = 280g / 20g = 14
        canOrder: false,
      },
      {
        index: 1,
        productId: product2Id,
        sizeId: sizeM2Id,
        requestedQuantity: 1,
        availableQuantity: 0, // 300g stock - 300g (Line 0 demand) = 0g
        canOrder: false,
      },
    ]);
  });

  // F. Derived remaining âm
  it('F. [Derived remaining âm] khi dòng khác vượt stock: availableQuantity = 0, canOrder = false, không 500', async () => {
    // Dòng 0 yêu cầu 20 ly (400g > 300g stock cà phê)
    // Dòng 1 còn lại 300 - 400 = -100g -> derived âm -> clamp về availableQuantity = 0
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [],
          quantity: 20,
        },
        {
          productId: product2Id,
          sizeId: sizeM2Id,
          toppingIds: [],
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body.canOrder).toBe(false);
    expect(res.body.items).toEqual([
      {
        index: 0,
        productId: productValidId,
        sizeId: sizeMId,
        requestedQuantity: 20,
        availableQuantity: 14, // 300g stock - 20g (Line 1 demand) = 280g / 20g = 14
        canOrder: false,
      },
      {
        index: 1,
        productId: product2Id,
        sizeId: sizeM2Id,
        requestedQuantity: 1,
        availableQuantity: 0, // 300g stock - 400g (Line 0 demand) = -100g -> 0
        canOrder: false,
      },
    ]);
  });

  // G. Product bị disable
  it('G. [Product bị disable] isAvailable = false có availableQuantity = 0 và canOrder = false', async () => {
    const payload = {
      items: [
        {
          productId: productDisabledId,
          sizeId: sizeDisabledId,
          toppingIds: [],
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body).toEqual({
      canOrder: false,
      items: [
        {
          index: 0,
          productId: productDisabledId,
          sizeId: sizeDisabledId,
          requestedQuantity: 1,
          availableQuantity: 0,
          canOrder: false,
        },
      ],
    });
  });

  // H. Option thiếu recipe
  it('H. [Option thiếu recipe] trả về availableQuantity = 0 và canOrder = false', async () => {
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeNoRecipeId,
          toppingIds: [],
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body).toEqual({
      canOrder: false,
      items: [
        {
          index: 0,
          productId: productValidId,
          sizeId: sizeNoRecipeId,
          requestedQuantity: 1,
          availableQuantity: 0,
          canOrder: false,
        },
      ],
    });
  });

  // I. Option không thuộc Product
  it('I. [Option không thuộc Product] trả về HTTP 400 Bad Request không rò rỉ database internals', async () => {
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: foreignSizeId, // Size của product khác
          toppingIds: [],
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toMatch(/không thuộc sản phẩm/i);
    // Không rò rỉ SQL query hoặc Prisma error
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|sql|foreign key|unique constraint/i);
  });

  // J. Duplicate topping
  it('J. [Duplicate topping] từ chối với HTTP 400 Bad Request khi gửi lặp toppingId', async () => {
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [toppingEspressoId, toppingEspressoId], // Duplicate topping
          quantity: 1,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(400);

    expect(res.body.statusCode).toBe(400);
  });

  // K. Payload sai (DTO Validation)
  describe('K. [Payload sai]', () => {
    it('từ chối khi items rỗng', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({ items: [] })
        .expect(400);
    });

    it('từ chối khi thiếu items', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({})
        .expect(400);
    });

    it('từ chối khi quantity = 0', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({
          items: [
            {
              productId: productValidId,
              sizeId: sizeMId,
              toppingIds: [],
              quantity: 0,
            },
          ],
        })
        .expect(400);
    });

    it('từ chối khi quantity âm', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({
          items: [
            {
              productId: productValidId,
              sizeId: sizeMId,
              toppingIds: [],
              quantity: -2,
            },
          ],
        })
        .expect(400);
    });

    it('từ chối khi quantity > 99', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({
          items: [
            {
              productId: productValidId,
              sizeId: sizeMId,
              toppingIds: [],
              quantity: 100,
            },
          ],
        })
        .expect(400);
    });

    it('từ chối khi UUID sai định dạng', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({
          items: [
            {
              productId: 'invalid-not-uuid',
              sizeId: sizeMId,
              toppingIds: [],
              quantity: 1,
            },
          ],
        })
        .expect(400);
    });

    it('từ chối khi toppingIds không phải array', async () => {
      await request(app.getHttpServer())
        .post('/api/products/availability')
        .send({
          items: [
            {
              productId: productValidId,
              sizeId: sizeMId,
              toppingIds: 'invalid-topping-string',
              quantity: 1,
            },
          ],
        })
        .expect(400);
    });
  });

  // L. Endpoint read-only
  it('L. [Endpoint read-only] không thay đổi stock, version và không tạo đơn hàng hay reservation', async () => {
    // 1. Đọc snapshot trước khi gọi API
    const [coffeeBefore, milkBefore, ordersBefore] = await Promise.all([
      prisma.ingredient.findUniqueOrThrow({ where: { id: ingCoffeeId } }),
      prisma.ingredient.findUniqueOrThrow({ where: { id: ingMilkId } }),
      prisma.order.count(),
    ]);

    // 2. Thực hiện gọi kiểm tra availability
    const payload = {
      items: [
        {
          productId: productValidId,
          sizeId: sizeMId,
          toppingIds: [toppingEspressoId],
          quantity: 5,
        },
        {
          productId: product2Id,
          sizeId: sizeM2Id,
          toppingIds: [],
          quantity: 2,
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/api/products/availability')
      .send(payload)
      .expect(201);

    expect(res.body.canOrder).toBe(true);

    // 3. Đọc snapshot sau khi gọi API
    const [coffeeAfter, milkAfter, ordersAfter] = await Promise.all([
      prisma.ingredient.findUniqueOrThrow({ where: { id: ingCoffeeId } }),
      prisma.ingredient.findUniqueOrThrow({ where: { id: ingMilkId } }),
      prisma.order.count(),
    ]);

    // 4. Đối chiếu bất biến: stock không đổi, version không đổi, không có order phát sinh
    expect(coffeeAfter.stock.toString()).toBe(coffeeBefore.stock.toString());
    expect(coffeeAfter.version).toBe(coffeeBefore.version);

    expect(milkAfter.stock.toString()).toBe(milkBefore.stock.toString());
    expect(milkAfter.version).toBe(milkBefore.version);

    expect(ordersAfter).toBe(ordersBefore);
  });
});
