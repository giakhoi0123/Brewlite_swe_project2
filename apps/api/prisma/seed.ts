import { PrismaClient, OptionType } from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_PRODUCTS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Cà phê đen đá',
    basePrice: 25000,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    isAvailable: true,
    inventory: {
      quantity: 150,
      reserved: 0,
    },
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
    inventory: {
      quantity: 200,
      reserved: 0,
    },
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
    inventory: {
      quantity: 120,
      reserved: 0,
    },
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
    inventory: {
      quantity: 80,
      reserved: 0,
    },
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
    inventory: {
      quantity: 90,
      reserved: 0,
    },
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
    inventory: {
      quantity: 60,
      reserved: 0,
    },
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
    inventory: {
      quantity: 0,
      reserved: 0,
    },
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
    inventory: {
      quantity: 75,
      reserved: 0,
    },
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
      for (const item of SEED_PRODUCTS) {
        const { inventory, options, ...productData } = item;

        // 1. Upsert product
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

        // 2. Upsert inventory
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

        // 3. Synchronize product options:
        // Lấy danh sách option ID được khai báo cho sản phẩm hiện tại
        const seedOptionIds = options.map((opt) => opt.id);

        // Xóa các ProductOption thuộc chính sản phẩm đó nhưng không còn xuất hiện trong danh sách seed
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

        // Upsert toàn bộ option đang được khai báo
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
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );

  console.log(`✅ Successfully seeded ${SEED_PRODUCTS.length} products with inventories and options.`);
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
