import { OptionType, OrderStatus, Prisma } from '@prisma/client';
import {
  BaristaOrderResponse,
  CalculatedItemPrice,
  CalculatedOrderPrice,
  CreateOrderItemResponse,
  CreateOrderResult,
  OptionSnapshotItem,
} from './orders.types';

export interface ProductPriceSource {
  id: string;
  name: string;
  basePrice: Prisma.Decimal | number | string;
}

export interface OptionPriceSource {
  id: string;
  name: string;
  type: OptionType;
  extraPrice: Prisma.Decimal | number | string;
}

export interface OrderItemCalculationInput {
  product: ProductPriceSource;
  quantity: number;
  options: OptionPriceSource[];
  notes?: string;
}

export const FREE_SHIPPING_THRESHOLD = 100000;
export const SHIPPING_FEE = 15000;

export function calculateShippingFee(
  subtotal: Prisma.Decimal | number | string,
): Prisma.Decimal {
  const subtotalDecimal = new Prisma.Decimal(subtotal);
  if (
    subtotalDecimal.lte(0) ||
    subtotalDecimal.gte(FREE_SHIPPING_THRESHOLD)
  ) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(SHIPPING_FEE);
}

/**
 * Ánh xạ kết quả lưu trữ Order sang CreateOrderResult cho client.
 * Tuyệt đối không để lộ dữ liệu nội bộ như stock, version, reservation ID.
 */
export function mapOrderResponse(
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    subtotal: Prisma.Decimal;
    discount: Prisma.Decimal;
    shippingFee?: Prisma.Decimal | number;
    total: Prisma.Decimal;
    createdAt: Date;
  },
  items?: CreateOrderItemResponse[],
): CreateOrderResult {
  return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal.toNumber(),
    discount: order.discount.toNumber(),
    shippingFee:
      order.shippingFee !== undefined ? Number(order.shippingFee) : 0,
    total: order.total.toNumber(),
    createdAt: order.createdAt.toISOString(),
    ...(items ? { items } : {}),
  };
}

/**
 * Sắp xếp các option theo thứ tự tất định (deterministic):
 * Ưu tiên SIZE trước TOPPING, sau đó theo id tăng dần.
 */
export function sortOptionsDeterministic<T extends { type: OptionType; id: string }>(
  options: T[],
): T[] {
  return [...options].sort((a, b) => {
    if (a.type === OptionType.SIZE && b.type !== OptionType.SIZE) return -1;
    if (a.type !== OptionType.SIZE && b.type === OptionType.SIZE) return 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Tính toán đơn giá, thành tiền và snapshot cho một dòng sản phẩm (OrderItem).
 * Toàn bộ phép tính sử dụng Prisma.Decimal.
 */
export function calculateItemPrice(
  input: OrderItemCalculationInput,
): CalculatedItemPrice {
  const basePriceDecimal = new Prisma.Decimal(input.product.basePrice);
  const sortedOptions = sortOptionsDeterministic(input.options);

  let extraPriceTotal = new Prisma.Decimal(0);
  const normalizedOptions: CalculatedItemPrice['options'] = [];
  const optionsSnapshot: OptionSnapshotItem[] = [];

  for (const opt of sortedOptions) {
    const extraDecimal = new Prisma.Decimal(opt.extraPrice);
    extraPriceTotal = extraPriceTotal.plus(extraDecimal);

    normalizedOptions.push({
      optionId: opt.id,
      optionName: opt.name,
      optionType: opt.type,
      extraPrice: extraDecimal,
    });

    optionsSnapshot.push({
      id: opt.id,
      name: opt.name,
      type: opt.type,
      extraPrice: extraDecimal.toNumber(),
    });
  }

  const finalUnitPrice = basePriceDecimal.plus(extraPriceTotal);
  const quantityDecimal = new Prisma.Decimal(input.quantity);
  const itemSubtotal = finalUnitPrice.mul(quantityDecimal);

  return {
    productId: input.product.id,
    productName: input.product.name,
    basePrice: basePriceDecimal,
    options: normalizedOptions,
    unitPrice: finalUnitPrice,
    quantity: input.quantity,
    subtotal: itemSubtotal,
    optionsSnapshot,
    notes: input.notes,
  };
}

/**
 * Tính toán tổng tiền đơn hàng, áp dụng discount (nếu có) và cap discount an toàn.
 * Đảm bảo: 0 <= discount <= subtotal và total = subtotal - discount + shippingFee.
 */
export function calculateOrderPricing(
  items: CalculatedItemPrice[],
  discountInput?: Prisma.Decimal | number | string | null,
  promotionInfo?: { voucherCode?: string; promotionId?: string },
): CalculatedOrderPrice {
  let subtotal = new Prisma.Decimal(0);

  for (const item of items) {
    subtotal = subtotal.plus(item.subtotal);
  }

  let discount = new Prisma.Decimal(discountInput ?? 0);
  if (discount.isNegative()) {
    discount = new Prisma.Decimal(0);
  }

  // Cap discount: 0 <= discount <= subtotal
  if (discount.gt(subtotal)) {
    discount = subtotal;
  }

  const shippingFee = calculateShippingFee(subtotal);
  const total = subtotal.minus(discount).plus(shippingFee);

  return {
    items,
    subtotal,
    discount,
    shippingFee,
    total,
    voucherCode: promotionInfo?.voucherCode,
    promotionId: promotionInfo?.promotionId,
  };
}

/**
 * Ánh xạ đơn hàng sang định dạng an toàn cho Barista UI / Queue.
 * Tuyệt đối không để lộ dữ liệu nội bộ (stock, version, cost, reservation lines, password, auth tokens).
 */
export function mapBaristaOrderResponse(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  shippingFee?: Prisma.Decimal | number;
  total: Prisma.Decimal;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  payments?: Array<{
    processedAt: Date | null;
  }>;
  user?: {
    id: string;
    fullName: string;
  } | null;
  items?: Array<{
    id: string;
    productId: string;
    productNameSnapshot: string;
    unitPriceSnapshot: Prisma.Decimal;
    quantity: number;
    subtotal: Prisma.Decimal;
    notes?: string | null;
    optionsSnapshot?: Prisma.JsonValue | null;
    orderItemOptions?: Array<{
      id: string;
      productOptionId: string;
      optionNameSnapshot: string;
      optionType: OptionType;
      extraPriceSnapshot: Prisma.Decimal;
    }>;
  }>;
}): BaristaOrderResponse {
  return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal.toNumber(),
    discount: order.discount.toNumber(),
    shippingFee:
      order.shippingFee !== undefined ? Number(order.shippingFee) : 0,
    total: order.total.toNumber(),
    notes: order.notes ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.payments?.[0]?.processedAt?.toISOString() ?? null,
    customer: order.user
      ? {
          id: order.user.id,
          fullName: order.user.fullName,
        }
      : null,
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productNameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPriceSnapshot.toNumber(),
      subtotal: item.subtotal.toNumber(),
      notes: item.notes ?? null,
      optionsSnapshot: item.optionsSnapshot,
      options: (item.orderItemOptions || []).map((opt) => ({
        id: opt.id,
        productOptionId: opt.productOptionId,
        name: opt.optionNameSnapshot,
        type: opt.optionType,
        extraPrice: opt.extraPriceSnapshot.toNumber(),
      })),
    })),
  };
}
