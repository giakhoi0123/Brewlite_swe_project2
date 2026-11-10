import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { OptionType, OrderStatus, Prisma, UserRole } from '@prisma/client';

/**
 * ==============================================================================
 * QUY ƯỚC TÍNH TOÁN GIÁ & SNAPSHOT DỮ LIỆU ĐƠN HÀNG (Task 5.1 - Lê Quang Điệp)
 * ==============================================================================
 *
 * 1. NGUYÊN TẮC BẢO MẬT & TOÀN VẸN TÀI CHÍNH (Server-Side Price Recalculation):
 *    - Tuyệt đối KHÔNG tin tưởng bất kỳ giá trị tài chính (price, unitPrice, subtotal,
 *      discount, total) nào do client gửi lên.
 *    - Toàn bộ phép tính tài chính và nguyên liệu PHẢI sử dụng `Prisma.Decimal`.
 *
 * 2. CÔNG THỨC TÍNH GIÁ CHUẨN:
 *    a. Đơn giá món (finalUnitPrice):
 *       finalUnitPrice = Product.basePrice + SUM(ProductOption.extraPrice)
 *       với mọi option hợp lệ được chọn thuộc về Product đó.
 *
 *    b. Snapshot đơn giá món (OrderItem.unitPriceSnapshot):
 *       OrderItem.unitPriceSnapshot = finalUnitPrice
 *
 *    c. Thành tiền dòng món (OrderItem.subtotal):
 *       OrderItem.subtotal = finalUnitPrice * quantity
 *
 *    d. Tạm tính đơn hàng (Order.subtotal):
 *       Order.subtotal = SUM(OrderItem.subtotal)
 *
 *    e. Giảm giá (Order.discount):
 *       Được tính toán và xác thực độc lập từ Promotion Engine (nếu có voucherCode hợp lệ).
 *       Ràng buộc: 0 <= Order.discount <= Order.subtotal.
 *
 *    f. Tổng thanh toán đơn hàng (Order.total):
 *       Order.total = Order.subtotal - Order.discount
 *       Ràng buộc cơ sở dữ liệu: total >= 0.
 *
 * 3. QUY ƯỚC HAI BIỂU DIỄN SNAPSHOT OPTIONS:
 *    a. Bảng quan hệ chuẩn hóa (Normalized Primary Source of Truth):
 *       `OrderItemOption`: Lưu từng dòng option kèm khóa ngoại, loại option,
 *       tên snapshot và extraPriceSnapshot. Đảm bảo toàn vẹn tham chiếu và báo cáo.
 *
 *    b. Denormalized Read Snapshot:
 *       `OrderItem.optionsSnapshot` (JSONB): Lưu mảng JSON các option đã chọn để
 *       Barista UI và Order Detail truy xuất O(1) mà không cần JOIN phức tạp.
 *
 *    c. Đồng bộ dữ liệu: Cả hai biểu diễn bắt buộc phải được tạo từ cùng danh sách
 *       ProductOption đã được xác thực trong cùng một database transaction.
 * ==============================================================================
 */

export type OptionSnapshotItem = {
  id: string;
  name: string;
  type: OptionType;
  extraPrice: number;
  [key: string]: Prisma.InputJsonValue | undefined;
};

export interface CalculatedItemPrice {
  productId: string;
  productName: string;
  basePrice: Prisma.Decimal;
  options: Array<{
    optionId: string;
    optionName: string;
    optionType: OptionType;
    extraPrice: Prisma.Decimal;
  }>;
  unitPrice: Prisma.Decimal;
  quantity: number;
  subtotal: Prisma.Decimal;
  optionsSnapshot: OptionSnapshotItem[];
  notes?: string;
}

export interface CalculatedOrderPrice {
  items: CalculatedItemPrice[];
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  voucherCode?: string;
  promotionId?: string;
}

export interface CreateOrderItemResponse {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
  options: OptionSnapshotItem[];
}

export interface CreateOrderResult {
  id: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
  items?: CreateOrderItemResponse[];
}

export interface AggregatedIngredientRequirement {
  ingredientId: string;
  ingredientName?: string;
  totalAmount: Prisma.Decimal;
}

/**
 * ==============================================================================
 * DTO VÀ TYPE CHO BARISTA QUEUE VÀ BARISTA ACTIONS (ĐỢT 3 - Task 5.1)
 * ==============================================================================
 */

export interface BaristaQueueItemOption {
  id: string;
  productOptionId: string;
  name: string;
  type: OptionType;
  extraPrice: number;
}

export interface BaristaQueueItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  optionsSnapshot?: Prisma.JsonValue | null;
  options: BaristaQueueItemOption[];
}

export interface BaristaQueueCustomer {
  id: string;
  fullName: string;
}

export interface BaristaOrderResponse {
  id: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: BaristaQueueCustomer | null;
  items: BaristaQueueItem[];
}

export interface BaristaQueueResult {
  data: BaristaOrderResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * ==============================================================================
 * CHUẨN HÓA AUTHENTICATED ACTOR TỪ JWT (ĐỢT 3.1 - Task 5.1)
 * ==============================================================================
 */

export interface AuthenticatedUserPayload {
  id?: string;
  userId?: string;
  email?: string;
  fullName?: string;
  role?: UserRole;
}

export interface AuthenticatedActor {
  userId: string;
  role: UserRole;
}

/**
 * Helper thống nhất trích xuất và xác thực Actor từ JWT session (req.user):
 * - Tuyệt đối không silently tiếp tục nếu thiếu userId hoặc role.
 * - Trả về 401 Unauthorized nếu thiếu user ID.
 * - Trả về 403 Forbidden nếu role không xác định.
 * - Ngăn chặn triệt để JWT giả mạo vai trò hệ thống SYSTEM hoặc PAYMENT.
 */
export function extractAuthenticatedActor(
  user: AuthenticatedUserPayload | undefined | null,
): AuthenticatedActor {
  if (!user) {
    throw new UnauthorizedException('Yêu cầu đăng nhập để tiếp tục.');
  }

  const userId = user.id || user.userId;
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new UnauthorizedException(
      'Phiên đăng nhập không hợp lệ: Thiếu định danh người dùng.',
    );
  }

  const role = user.role;
  if (!role || !Object.values(UserRole).includes(role)) {
    throw new ForbiddenException(
      'Phiên đăng nhập không hợp lệ: Quyền người dùng không xác định.',
    );
  }

  if ((role as string) === 'SYSTEM' || (role as string) === 'PAYMENT') {
    throw new ForbiddenException(
      'Không thể thực thi vai trò hệ thống qua phiên xác thực người dùng.',
    );
  }

  return {
    userId: userId.trim(),
    role,
  };
}

/**
 * ==============================================================================
 * CUSTOMER RESPONSE CONTRACTS (Task 5.1 - Privacy Guard)
 * ==============================================================================
 * Tuyệt đối không trả về:
 * - reservation, reservation lines
 * - ingredientId, ingredient amounts, stock
 * - version nội bộ, passwordHash, sessionVersion, loyaltyLog
 */
export interface CustomerOrderItemOptionResponse {
  id: string;
  productOptionId: string;
  optionNameSnapshot: string;
  optionType: OptionType;
  extraPriceSnapshot: number;
}

export interface CustomerOrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  productNameSnapshot: string;
  unitPrice: number;
  unitPriceSnapshot: number;
  quantity: number;
  subtotal: number;
  notes: string | null;
  options: CustomerOrderItemOptionResponse[];
}

export interface CustomerOrderResponse {
  id: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  promotion: {
    code: string;
    description: string | null;
  } | null;
  items: CustomerOrderItemResponse[];
}

export function mapCustomerOrderResponse(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: Prisma.Decimal | number;
  discount: Prisma.Decimal | number;
  total: Prisma.Decimal | number;
  voucherCode?: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  promotion?: { code: string; description: string | null } | null;
  items?: Array<{
    id: string;
    productId: string;
    productNameSnapshot: string;
    unitPriceSnapshot: Prisma.Decimal | number;
    quantity: number;
    subtotal: Prisma.Decimal | number;
    notes?: string | null;
    orderItemOptions?: Array<{
      id: string;
      productOptionId: string;
      optionNameSnapshot: string;
      optionType: OptionType;
      extraPriceSnapshot: Prisma.Decimal | number;
    }>;
  }>;
}): CustomerOrderResponse {
  const subtotalNum =
    typeof order.subtotal === 'number'
      ? order.subtotal
      : Number(order.subtotal);
  const discountNum =
    typeof order.discount === 'number'
      ? order.discount
      : Number(order.discount);
  const totalNum =
    typeof order.total === 'number' ? order.total : Number(order.total);

  return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: subtotalNum,
    discount: discountNum,
    total: totalNum,
    totalAmount: subtotalNum,
    discountAmount: discountNum,
    finalAmount: totalNum,
    voucherCode: order.voucherCode ?? null,
    pointsEarned: order.pointsEarned,
    pointsRedeemed: order.pointsRedeemed,
    notes: order.notes ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    promotion: order.promotion
      ? {
          code: order.promotion.code,
          description: order.promotion.description ?? null,
        }
      : null,
    items: (order.items ?? []).map((item) => {
      const unitPriceNum =
        typeof item.unitPriceSnapshot === 'number'
          ? item.unitPriceSnapshot
          : Number(item.unitPriceSnapshot);
      const itemSubtotalNum =
        typeof item.subtotal === 'number'
          ? item.subtotal
          : Number(item.subtotal);
      return {
        id: item.id,
        productId: item.productId,
        productName: item.productNameSnapshot,
        productNameSnapshot: item.productNameSnapshot,
        unitPrice: unitPriceNum,
        unitPriceSnapshot: unitPriceNum,
        quantity: item.quantity,
        subtotal: itemSubtotalNum,
        notes: item.notes ?? null,
        options: (item.orderItemOptions ?? []).map((opt) => ({
          id: opt.id,
          productOptionId: opt.productOptionId,
          optionNameSnapshot: opt.optionNameSnapshot,
          optionType: opt.optionType,
          extraPriceSnapshot:
            typeof opt.extraPriceSnapshot === 'number'
              ? opt.extraPriceSnapshot
              : Number(opt.extraPriceSnapshot),
        })),
      };
    }),
  };
}
