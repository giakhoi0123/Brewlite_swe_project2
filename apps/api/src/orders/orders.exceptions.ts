import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/**
 * 1. User không tồn tại trong hệ thống.
 */
export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super(`Người dùng với ID "${userId}" không tồn tại trong hệ thống.`);
  }
}

/**
 * 2. Product không tồn tại.
 */
export class ProductNotFoundException extends NotFoundException {
  constructor(productId: string) {
    super(`Sản phẩm với ID "${productId}" không tồn tại.`);
  }
}

/**
 * 3. Product không mở bán (isAvailable = false).
 */
export class ProductUnavailableException extends BadRequestException {
  constructor(productId: string, productName?: string) {
    super(
      `Sản phẩm "${productName || productId}" hiện đang tạm ngừng kinh doanh hoặc không mở bán.`,
    );
  }
}

/**
 * 4. ProductOption không tồn tại.
 */
export class ProductOptionNotFoundException extends BadRequestException {
  constructor(optionId: string) {
    super(`Tùy chọn sản phẩm với ID "${optionId}" không tồn tại.`);
  }
}

/**
 * 5. Option không thuộc Product của OrderItem.
 */
export class ProductOptionMismatchException extends BadRequestException {
  constructor(optionId: string, productId: string) {
    super(
      `Tùy chọn với ID "${optionId}" không thuộc về sản phẩm "${productId}".`,
    );
  }
}

/**
 * 6. Duplicate option trong cùng một OrderItem.
 */
export class DuplicateProductOptionException extends BadRequestException {
  constructor(optionId: string) {
    super(
      `Tùy chọn với ID "${optionId}" bị trùng lặp trong cùng một món hàng.`,
    );
  }
}

/**
 * 7. Món hàng thiếu tùy chọn SIZE bắt buộc.
 */
export class MissingSizeOptionException extends BadRequestException {
  constructor(productId: string) {
    super(
      `Món hàng "${productId}" bắt buộc phải chọn chính xác một kích cỡ (SIZE).`,
    );
  }
}

/**
 * 8. Món hàng có nhiều hơn một tùy chọn SIZE.
 */
export class MultipleSizeOptionsException extends BadRequestException {
  constructor(productId: string, sizeCount: number) {
    super(
      `Món hàng "${productId}" chỉ được phép chọn duy nhất 1 kích cỡ, nhận được: ${sizeCount}.`,
    );
  }
}

/**
 * 9. Option không có OptionRecipe được định nghĩa.
 */
export class OptionMissingRecipeException extends BadRequestException {
  constructor(optionId: string, optionName?: string) {
    super(
      `Tùy chọn "${optionName || optionId}" chưa được định nghĩa công thức nguyên liệu (recipe).`,
    );
  }
}

/**
 * 10. Ingredient trong công thức không tồn tại trong kho.
 */
export class IngredientNotFoundException extends NotFoundException {
  constructor(ingredientId: string) {
    super(`Nguyên liệu với ID "${ingredientId}" không tồn tại trong kho.`);
  }
}

/**
 * 11. Không đủ nguyên liệu trong kho để đáp ứng đơn hàng (HTTP 409 Conflict).
 */
export class InsufficientIngredientStockException extends ConflictException {
  constructor(
    public readonly ingredientId: string,
    public readonly ingredientName: string,
    public readonly required: string,
    public readonly available: string,
  ) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: `Nguyên liệu "${ingredientName}" không đủ tồn kho để đáp ứng đơn hàng.`,
      ingredientId,
      ingredientName,
      required,
      available,
    });
  }
}

/**
 * 12. Voucher không hợp lệ hoặc không áp dụng được.
 */
export class InvalidVoucherException extends BadRequestException {
  constructor(voucherCode: string, reason?: string) {
    super(
      `Mã khuyến mãi "${voucherCode}" không hợp lệ: ${reason || 'Không thể áp dụng'}.`,
    );
  }
}

/**
 * 13. Xung đột tồn kho do giao dịch đồng thời (HTTP 409 Conflict).
 */
export class ConcurrentStockConflictException extends ConflictException {
  constructor(ingredientId?: string) {
    super(
      `Xung đột cập nhật tồn kho đồng thời${ingredientId ? ` đối với nguyên liệu ${ingredientId}` : ''}. Vui lòng thử lại.`,
    );
  }
}

/**
 * 14. Xung đột transaction cơ sở dữ liệu.
 */
export class TransactionConflictException extends ConflictException {
  constructor(
    message = 'Giao dịch cơ sở dữ liệu gặp xung đột cạnh tranh tài nguyên.',
  ) {
    super(message);
  }
}

/**
 * 15. Không thể tạo order number duy nhất sau khi đã thử lại tối đa.
 */
export class OrderNumberConflictException extends ConflictException {
  constructor(
    message = 'Không thể tạo mã đơn hàng duy nhất sau số lần thử tối đa.',
  ) {
    super(message);
  }
}

/**
 * 16. Order không tồn tại (HTTP 404 Not Found).
 */
export class OrderNotFoundException extends NotFoundException {
  constructor(orderId: string) {
    super(`Đơn hàng với ID "${orderId}" không tồn tại.`);
  }
}

/**
 * 17. Chuyển trạng thái đơn hàng không hợp lệ (HTTP 409 Conflict).
 * Đây là domain exception duy nhất biểu diễn chuyển trạng thái không hợp lệ trong Order State Machine.
 */
export class InvalidOrderTransitionException extends ConflictException {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
    public readonly allowed: readonly OrderStatus[] = [],
  ) {
    const allowedText =
      allowed.length > 0
        ? allowed.map((s) => `"${s}"`).join(', ')
        : 'không có (trạng thái kết thúc terminal)';
    super(
      `Không thể chuyển trạng thái đơn hàng từ "${from}" sang "${to}". Các trạng thái hợp lệ tiếp theo: [${allowedText}].`,
    );
  }
}

/**
 * 18. Xung đột phiên bản / trạng thái Order do cập nhật đồng thời (HTTP 409 Conflict).
 */
export class OrderStateConflictException extends ConflictException {
  constructor(orderId: string, currentVersion?: number) {
    super(
      `Xung đột trạng thái đơn hàng "${orderId}"${
        currentVersion !== undefined ? ` (phiên bản ${currentVersion})` : ''
      }. Đơn hàng đã bị thay đổi bởi giao dịch khác.`,
    );
  }
}

/**
 * 19. Không tìm thấy bản ghi giữ kho (reservation) của Order (HTTP 404 Not Found).
 */
export class ReservationNotFoundException extends NotFoundException {
  constructor(orderId: string) {
    super(
      `Không tìm thấy bản ghi giữ chỗ tồn kho (reservation) cho đơn hàng "${orderId}".`,
    );
  }
}

/**
 * 20. Bản ghi giữ kho đã bị tiêu hao (CONSUMED), không thể hoàn hoặc hủy (HTTP 409 Conflict).
 */
export class ReservationAlreadyConsumedException extends ConflictException {
  constructor(orderId: string) {
    super(
      `Nguyên liệu cho đơn hàng "${orderId}" đã được tiêu hao (CONSUMED), không thể hủy hoặc hoàn kho.`,
    );
  }
}

/**
 * 21. Xung đột trạng thái giữ kho (reservation) do cập nhật đồng thời (HTTP 409 Conflict).
 */
export class ReservationStateConflictException extends ConflictException {
  constructor(reservationId: string, currentVersion?: number) {
    super(
      `Xung đột trạng thái giữ kho reservation "${reservationId}"${
        currentVersion !== undefined ? ` (phiên bản ${currentVersion})` : ''
      }. Vui lòng thử lại.`,
    );
  }
}

/**
 * 22. Đơn hàng ở trạng thái không được phép hủy (HTTP 409 Conflict).
 */
export class OrderCancellationNotAllowedException extends ConflictException {
  constructor(orderId: string, status: OrderStatus) {
    super({
      statusCode: 409,
      error: 'Conflict',
      code:
        status === OrderStatus.PREPARING
          ? 'ORDER_ALREADY_PREPARING'
          : 'ORDER_CANCELLATION_NOT_ALLOWED',
      message:
        status === OrderStatus.PREPARING
          ? 'Đơn hàng đã bắt đầu pha và không thể hủy.'
          : `Đơn hàng "${orderId}" đang ở trạng thái "${status}", không được phép hủy.`,
      orderId,
      currentStatus: status,
    });
  }
}

/**
 * 23. Actor / Role không có quyền thực hiện chuyển trạng thái này (HTTP 403 Forbidden).
 */
export class OrderActionForbiddenException extends ForbiddenException {
  constructor(
    public readonly role: string,
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(
      `Vai trò "${role}" không có quyền chuyển trạng thái đơn hàng từ "${from}" sang "${to}".`,
    );
  }
}

/**
 * Paid cancellation is fail-closed until Payments supplies the transactional
 * refund port. An order must never be cancelled without a durable refund.
 */
export class OrderRefundUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      statusCode: 503,
      error: 'Service Unavailable',
      code: 'ORDER_REFUND_UNAVAILABLE',
      message: 'Khong the ghi nhan hoan tien cho don hang tai thoi diem nay.',
    });
  }
}
