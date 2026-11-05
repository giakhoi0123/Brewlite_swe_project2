import {
  PrismaClient,
  OptionType,
  UserRole,
  IngredientUnit,
  DiscountType,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const SEED_PROMOTIONS = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    code: 'HELLOBREW',
    description: 'Giảm ngay 20.000 VNĐ cho đơn hàng từ 50.000 VNĐ',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: '20000.00',
    minOrderAmount: '50000.00',
    maxDiscount: null,
    usageLimit: 100,
    usedCount: 0,
    isActive: true,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    code: 'BREW20',
    description: 'Giảm 20% tối đa 30.000 VNĐ cho đơn hàng từ 100.000 VNĐ',
    discountType: DiscountType.PERCENTAGE,
    discountValue: '20.00',
    minOrderAmount: '100000.00',
    maxDiscount: '30000.00',
    usageLimit: 50,
    usedCount: 0,
    isActive: true,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-12-31T23:59:59Z'),
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    code: 'EXPIRED10',
    description: 'Mã giảm giá đã hết hạn (dùng test bắt lỗi validation)',
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: '10000.00',
    minOrderAmount: '0.00',
    maxDiscount: null,
    usageLimit: 10,
    usedCount: 0,
    isActive: true,
    startDate: new Date('2025-01-01T00:00:00Z'),
    endDate: new Date('2025-01-31T23:59:59Z'),
  },
];

export const SEED_INGREDIENTS = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    name: 'Cà phê hạt Robusta',
    unit: IngredientUnit.G,
    stock: '50000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    name: 'Sữa đặc có đường',
    unit: IngredientUnit.G,
    stock: '30000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    name: 'Sữa tươi thanh trùng',
    unit: IngredientUnit.ML,
    stock: '40000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000004',
    name: 'Trà sen Bảo Lộc',
    unit: IngredientUnit.G,
    stock: '10000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000005',
    name: 'Trà đen Ceylon',
    unit: IngredientUnit.G,
    stock: '15000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000006',
    name: 'Bột Matcha Uji Nhật',
    unit: IngredientUnit.G,
    stock: '5000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000007',
    name: 'Cà phê Arabica Cầu Đất',
    unit: IngredientUnit.G,
    stock: '0.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000008',
    name: 'Siro Cam Vàng & Sả',
    unit: IngredientUnit.ML,
    stock: '10000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000009',
    name: 'Thạch cà phê giòn',
    unit: IngredientUnit.G,
    stock: '8000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000010',
    name: 'Thạch sương sáo Đài Loan',
    unit: IngredientUnit.G,
    stock: '8000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000011',
    name: 'Củ năng ngâm',
    unit: IngredientUnit.G,
    stock: '6000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000012',
    name: 'Hạt sen thơm',
    unit: IngredientUnit.G,
    stock: '6000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000013',
    name: 'Đào ngâm miếng',
    unit: IngredientUnit.PIECE,
    stock: '1000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000014',
    name: 'Trân châu trắng',
    unit: IngredientUnit.G,
    stock: '8000.000',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000015',
    name: 'Kem cheese',
    unit: IngredientUnit.G,
    stock: '8000.000',
  },
];

export const SEED_OPTION_RECIPES = [
  // 1. Cà phê đen đá
  { productOptionId: 'b0000000-0000-0000-0000-000000000001', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '25.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000002', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '35.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000003', ingredientId: 'd0000000-0000-4000-8000-000000000009', amount: '40.000' },

  // 2. Cà phê sữa đá
  { productOptionId: 'b0000000-0000-0000-0000-000000000004', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '25.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000004', ingredientId: 'd0000000-0000-4000-8000-000000000002', amount: '30.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000005', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '35.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000005', ingredientId: 'd0000000-0000-4000-8000-000000000002', amount: '45.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000006', ingredientId: 'd0000000-0000-4000-8000-000000000010', amount: '40.000' },

  // 3. Bạc xỉu Sài Gòn
  { productOptionId: 'b0000000-0000-0000-0000-000000000007', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '15.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000007', ingredientId: 'd0000000-0000-4000-8000-000000000002', amount: '30.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000007', ingredientId: 'd0000000-0000-4000-8000-000000000003', amount: '80.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000008', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '20.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000008', ingredientId: 'd0000000-0000-4000-8000-000000000002', amount: '40.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000008', ingredientId: 'd0000000-0000-4000-8000-000000000003', amount: '120.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000009', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '15.000' },

  // 4. Trà sen vàng củ năng
  { productOptionId: 'b0000000-0000-0000-0000-000000000010', ingredientId: 'd0000000-0000-4000-8000-000000000004', amount: '15.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000011', ingredientId: 'd0000000-0000-4000-8000-000000000004', amount: '22.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000012', ingredientId: 'd0000000-0000-4000-8000-000000000011', amount: '50.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000013', ingredientId: 'd0000000-0000-4000-8000-000000000012', amount: '50.000' },

  // 5. Trà đào cam sả
  { productOptionId: 'b0000000-0000-0000-0000-000000000014', ingredientId: 'd0000000-0000-4000-8000-000000000005', amount: '15.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000014', ingredientId: 'd0000000-0000-4000-8000-000000000008', amount: '20.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000015', ingredientId: 'd0000000-0000-4000-8000-000000000005', amount: '22.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000015', ingredientId: 'd0000000-0000-4000-8000-000000000008', amount: '30.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000016', ingredientId: 'd0000000-0000-4000-8000-000000000013', amount: '3.000' },

  // 6. Matcha Latte Nhật Bản
  { productOptionId: 'b0000000-0000-0000-0000-000000000017', ingredientId: 'd0000000-0000-4000-8000-000000000006', amount: '8.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000017', ingredientId: 'd0000000-0000-4000-8000-000000000003', amount: '120.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000018', ingredientId: 'd0000000-0000-4000-8000-000000000006', amount: '12.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000018', ingredientId: 'd0000000-0000-4000-8000-000000000003', amount: '180.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000019', ingredientId: 'd0000000-0000-4000-8000-000000000014', amount: '40.000' },

  // 7. Cold Brew Cam Sả
  { productOptionId: 'b0000000-0000-0000-0000-000000000020', ingredientId: 'd0000000-0000-4000-8000-000000000007', amount: '30.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000020', ingredientId: 'd0000000-0000-4000-8000-000000000008', amount: '20.000' },

  // 8. Cà phê Trứng Nướng
  { productOptionId: 'b0000000-0000-0000-0000-000000000021', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '25.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000021', ingredientId: 'd0000000-0000-4000-8000-000000000003', amount: '60.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000022', ingredientId: 'd0000000-0000-4000-8000-000000000001', amount: '35.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000022', ingredientId: 'd0000000-0000-4000-8000-000000000003', amount: '90.000' },
  { productOptionId: 'b0000000-0000-0000-0000-000000000023', ingredientId: 'd0000000-0000-4000-8000-000000000015', amount: '50.000' },
];

export const SEED_PRODUCTS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Cà phê đen đá',
    basePrice: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 150, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000001', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000002', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 6000 },
      { id: 'b0000000-0000-0000-0000-000000000003', type: OptionType.TOPPING, name: 'Thạch cà phê', extraPrice: 5000 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Cà phê sữa đá',
    basePrice: 29000,
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 200, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000004', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000005', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 6000 },
      { id: 'b0000000-0000-0000-0000-000000000006', type: OptionType.TOPPING, name: 'Thạch sương sáo', extraPrice: 5000 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'Bạc xỉu Sài Gòn',
    basePrice: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 120, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000007', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000008', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 6000 },
      { id: 'b0000000-0000-0000-0000-000000000009', type: OptionType.TOPPING, name: 'Shot Espresso thêm', extraPrice: 10000 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    name: 'Trà sen vàng củ năng',
    basePrice: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 80, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000010', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000011', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 10000 },
      { id: 'b0000000-0000-0000-0000-000000000012', type: OptionType.TOPPING, name: 'Củ năng ngâm', extraPrice: 10000 },
      { id: 'b0000000-0000-0000-0000-000000000013', type: OptionType.TOPPING, name: 'Hạt sen thơm', extraPrice: 12000 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    name: 'Trà đào cam sả',
    basePrice: 42000,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 90, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000014', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000015', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 8000 },
      { id: 'b0000000-0000-0000-0000-000000000016', type: OptionType.TOPPING, name: 'Miếng đào giòn', extraPrice: 8000 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    name: 'Matcha Latte Nhật Bản',
    basePrice: 48000,
    imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 60, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000017', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000018', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 10000 },
      { id: 'b0000000-0000-0000-0000-000000000019', type: OptionType.TOPPING, name: 'Trân châu trắng', extraPrice: 8000 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    name: 'Cold Brew Cam Sả (Hết hàng)',
    basePrice: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80',
    isAvailable: false,
    inventory: { quantity: 0, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000020', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
    ],
  },
  {
    id: 'a0000000-0000-0000-0000-000000000008',
    name: 'Cà phê Trứng Nướng',
    basePrice: 52000,
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: { quantity: 75, reserved: 0 },
    options: [
      { id: 'b0000000-0000-0000-0000-000000000021', type: OptionType.SIZE, name: 'Size M (Tiêu chuẩn)', extraPrice: 0 },
      { id: 'b0000000-0000-0000-0000-000000000022', type: OptionType.SIZE, name: 'Size L (Lớn)', extraPrice: 10000 },
      { id: 'b0000000-0000-0000-0000-000000000023', type: OptionType.TOPPING, name: 'Kem Cheese nướng cháy', extraPrice: 12000 },
    ],
  },
];

export async function main() {
  console.log('🌱 Starting repeatable database seed for BrewLite...');

  await prisma.$transaction(
    async (tx) => {
      // 1. Upsert Products, Inventories, and ProductOptions
      for (const item of SEED_PRODUCTS) {
        const { inventory, options, ...productData } = item;

        await tx.product.upsert({
          where: { id: productData.id },
          update: {
            name: productData.name,
            basePrice: productData.basePrice,
            imageUrl: productData.imageUrl,
            isAvailable: productData.isAvailable,
          },
          create: {
            id: productData.id,
            name: productData.name,
            basePrice: productData.basePrice,
            imageUrl: productData.imageUrl,
            isAvailable: productData.isAvailable,
          },
        });

        await tx.inventory.upsert({
          where: { productId: productData.id },
          update: {
            quantity: inventory.quantity,
            reserved: inventory.reserved,
          },
          create: {
            productId: productData.id,
            quantity: inventory.quantity,
            reserved: inventory.reserved,
          },
        });

        const seedOptionIds = options.map((opt) => opt.id);

        if (seedOptionIds.length > 0) {
          await tx.productOption.deleteMany({
            where: {
              productId: productData.id,
              id: { notIn: seedOptionIds },
            },
          });
        } else {
          await tx.productOption.deleteMany({
            where: {
              productId: productData.id,
            },
          });
        }

        for (const opt of options) {
          await tx.productOption.upsert({
            where: { id: opt.id },
            update: {
              name: opt.name,
              type: opt.type,
              extraPrice: opt.extraPrice,
              productId: productData.id,
            },
            create: {
              id: opt.id,
              name: opt.name,
              type: opt.type,
              extraPrice: opt.extraPrice,
              productId: productData.id,
            },
          });
        }
      }

      // 2. Seed 15 Ingredients
      for (const ing of SEED_INGREDIENTS) {
        const existing = await tx.ingredient.findUnique({
          where: { id: ing.id },
        });

        if (!existing) {
          await tx.ingredient.create({
            data: {
              id: ing.id,
              name: ing.name,
              unit: ing.unit,
              stock: new Prisma.Decimal(ing.stock),
              version: 1,
            },
          });
        } else {
          if (existing.unit !== ing.unit) {
            throw new Error(
              `Unit mismatch for Ingredient ID ${ing.id}: existing="${existing.unit}" vs fixture="${ing.unit}". Cannot auto-migrate unit.`,
            );
          }

          if (existing.name !== ing.name) {
            await tx.ingredient.update({
              where: { id: ing.id },
              data: {
                name: ing.name,
              },
            });
          }
        }
      }

      // 3. Synchronize OptionRecipes
      const recipesByOption = new Map<string, typeof SEED_OPTION_RECIPES>();
      for (const recipe of SEED_OPTION_RECIPES) {
        const group = recipesByOption.get(recipe.productOptionId) || [];
        group.push(recipe);
        recipesByOption.set(recipe.productOptionId, group);
      }

      for (const item of SEED_PRODUCTS) {
        for (const opt of item.options) {
          const optionRecipes = recipesByOption.get(opt.id) || [];
          const fixtureIngredientIds = optionRecipes.map((r) => r.ingredientId);

          if (fixtureIngredientIds.length > 0) {
            await tx.optionRecipe.deleteMany({
              where: {
                productOptionId: opt.id,
                ingredientId: { notIn: fixtureIngredientIds },
              },
            });
          } else {
            await tx.optionRecipe.deleteMany({
              where: {
                productOptionId: opt.id,
              },
            });
          }

          for (const recipe of optionRecipes) {
            await tx.optionRecipe.upsert({
              where: {
                productOptionId_ingredientId: {
                  productOptionId: recipe.productOptionId,
                  ingredientId: recipe.ingredientId,
                },
              },
              update: {
                amount: new Prisma.Decimal(recipe.amount),
              },
              create: {
                productOptionId: recipe.productOptionId,
                ingredientId: recipe.ingredientId,
                amount: new Prisma.Decimal(recipe.amount),
              },
            });
          }
        }
      }

      // 4. Seed Promotions
      for (const promo of SEED_PROMOTIONS) {
        await tx.promotion.upsert({
          where: { code: promo.code },
          update: {
            description: promo.description,
            discountType: promo.discountType,
            discountValue: new Prisma.Decimal(promo.discountValue),
            minOrderAmount: new Prisma.Decimal(promo.minOrderAmount),
            maxDiscount: promo.maxDiscount ? new Prisma.Decimal(promo.maxDiscount) : null,
            usageLimit: promo.usageLimit,
            isActive: promo.isActive,
            startDate: promo.startDate,
            endDate: promo.endDate,
          },
          create: {
            id: promo.id,
            code: promo.code,
            description: promo.description,
            discountType: promo.discountType,
            discountValue: new Prisma.Decimal(promo.discountValue),
            minOrderAmount: new Prisma.Decimal(promo.minOrderAmount),
            maxDiscount: promo.maxDiscount ? new Prisma.Decimal(promo.maxDiscount) : null,
            usageLimit: promo.usageLimit,
            usedCount: promo.usedCount,
            isActive: promo.isActive,
            startDate: promo.startDate,
            endDate: promo.endDate,
          },
        });
      }
    },
    {
      maxWait: 5000,
      timeout: 25000,
    },
  );

  console.log(
    `✅ Successfully seeded ${SEED_PRODUCTS.length} products, ${SEED_INGREDIENTS.length} ingredients, ${SEED_OPTION_RECIPES.length} option recipes, and ${SEED_PROMOTIONS.length} promotions.`,
  );

  // Seed demo users & Initial Loyalty Points
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);
  const customerId = 'c0000000-0000-0000-0000-000000000001';

  const customer = await prisma.user.upsert({
    where: { email: 'customer@brewlite.test' },
    update: {
      passwordHash: defaultPasswordHash,
      loyaltyPoints: 100,
    },
    create: {
      id: customerId,
      email: 'customer@brewlite.test',
      fullName: 'Khách hàng thử nghiệm',
      passwordHash: defaultPasswordHash,
      role: UserRole.CUSTOMER,
      loyaltyPoints: 100,
    },
  });

  await prisma.user.upsert({
    where: { email: 'barista@brewlite.test' },
    update: {
      passwordHash: defaultPasswordHash,
    },
    create: {
      id: 'c0000000-0000-0000-0000-000000000002',
      email: 'barista@brewlite.test',
      fullName: 'Barista Quầy Pha Chế',
      passwordHash: defaultPasswordHash,
      role: UserRole.BARISTA,
    },
  });

  // Seed initial LoyaltyLog for demo customer
  await prisma.loyaltyLog.deleteMany({
    where: { userId: customer.id },
  });

  await prisma.loyaltyLog.create({
    data: {
      userId: customer.id,
      points: 100,
      reason: 'Tặng 100 điểm thưởng chào mừng thành viên mới',
    },
  });

  console.log('✅ Successfully seeded demo users & initial loyalty points for customer@brewlite.test.');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}