import { OrderStatus, UserRole } from '@prisma/client';
import {
  InvalidOrderTransitionException,
  OrderActionForbiddenException,
} from './orders.exceptions';

export {
  InvalidOrderTransitionException,
  OrderActionForbiddenException,
};

/**
 * Kiểu định danh cho Actor/Role thực hiện chuyển trạng thái trong hệ thống:
 * Bao gồm các vai trò người dùng trong DB (UserRole) và các định danh hệ thống tin cậy nội bộ (SYSTEM, PAYMENT).
 */
export type SystemActorRole = UserRole | 'SYSTEM' | 'PAYMENT';

/**
 * Định nghĩa bảng chuyển trạng thái (State Machine Transitions) cho Order theo Task 5.1:
 *
 * Cho phép đúng các transitions:
 * - PENDING -> PAID (thanh toán thành công)
 * - PENDING -> PAYMENT_FAILED (thanh toán thất bại)
 * - PENDING -> CANCELLED (khách hàng hoặc quản lý hủy đơn)
 * - PAYMENT_FAILED -> PENDING (khách hàng thử lại thanh toán qua boundary hợp lệ)
 * - PAYMENT_FAILED -> CANCELLED (khách hàng hoặc hệ thống hủy đơn sau khi thất bại)
 * - PAID -> PREPARING (barista bắt đầu pha chế)
 * - PREPARING -> READY (barista hoàn tất pha chế, sẵn sàng giao)
 * - READY -> COMPLETED (barista / quản lý hoàn tất giao hàng)
 *
 * Trạng thái terminal (kết thúc, không chuyển tiếp):
 * - COMPLETED
 * - CANCELLED
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.PREPARING,
  ],
  [OrderStatus.PREPARING]: [
    OrderStatus.READY,
  ],
  [OrderStatus.READY]: [
    OrderStatus.COMPLETED,
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
} as const;

/**
 * NGUỒN SỰ THẬT DUY NHẤT VỀ PHÂN QUYỀN VAI TRÒ (RBAC STATE TRANSITION MATRIX):
 * Định nghĩa rõ vai trò / actor nào được phép kích hoạt từng bước chuyển trạng thái cụ thể.
 *
 * Quy tắc bảo mật:
 * 1. PENDING -> PAID: CHỈ internal Payments/System boundary ('SYSTEM', 'PAYMENT').
 *    TUYỆT ĐỐI KHÔNG cho CUSTOMER hoặc BARISTA tự đánh dấu đơn thành PAID.
 * 2. READY -> COMPLETED: CHỈ nhân viên quầy BARISTA hoặc MANAGER.
 *    TUYỆT ĐỐI KHÔNG cho CUSTOMER tự xác nhận hoàn tất đơn.
 * 3. PAID -> PREPARING & PREPARING -> READY: CHỈ BARISTA hoặc MANAGER.
 * 4. PENDING -> CANCELLED: CUSTOMER (chủ đơn) hoặc MANAGER.
 * 5. PAYMENT_FAILED -> PENDING: CUSTOMER (khi retry), 'SYSTEM', 'PAYMENT'.
 */
export const ALLOWED_TRANSITION_ACTORS: Readonly<
  Record<
    OrderStatus,
    Partial<Record<OrderStatus, readonly (UserRole | 'SYSTEM' | 'PAYMENT')[]>>
  >
> = {
  [OrderStatus.PENDING]: {
    [OrderStatus.PAID]: ['SYSTEM', 'PAYMENT'], // CUSTOMER và BARISTA hoàn toàn bị cấm
    [OrderStatus.PAYMENT_FAILED]: ['SYSTEM', 'PAYMENT'],
    [OrderStatus.CANCELLED]: [UserRole.CUSTOMER, UserRole.MANAGER],
  },
  [OrderStatus.PAYMENT_FAILED]: {
    [OrderStatus.PENDING]: [UserRole.CUSTOMER, 'SYSTEM', 'PAYMENT'],
    [OrderStatus.CANCELLED]: [
      UserRole.CUSTOMER,
      UserRole.MANAGER,
      'SYSTEM',
      'PAYMENT',
    ],
  },
  [OrderStatus.PAID]: {
    [OrderStatus.PREPARING]: [UserRole.BARISTA, UserRole.MANAGER],
  },
  [OrderStatus.PREPARING]: {
    [OrderStatus.READY]: [UserRole.BARISTA, UserRole.MANAGER],
  },
  [OrderStatus.READY]: {
    [OrderStatus.COMPLETED]: [UserRole.BARISTA, UserRole.MANAGER], // CUSTOMER hoàn toàn bị cấm
  },
  [OrderStatus.COMPLETED]: {},
  [OrderStatus.CANCELLED]: {},
} as const;

/**
 * Tập các trạng thái kết thúc (terminal) không thể chuyển sang trạng thái khác.
 */
export const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
]);

/**
 * Tập các trạng thái được phép hủy đơn (cancellable) và hoàn kho.
 */
export const CANCELLABLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PENDING,
  OrderStatus.PAYMENT_FAILED,
]);

/**
 * Lấy danh sách các trạng thái hợp lệ tiếp theo từ trạng thái hiện tại.
 */
export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from] || [];
}

/**
 * Kiểm tra một trạng thái có phải là trạng thái kết thúc (terminal) hay không.
 */
export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.has(status);
}

/**
 * Kiểm tra một trạng thái có được phép hủy hay không.
 */
export function isCancellableStatus(status: OrderStatus): boolean {
  return CANCELLABLE_ORDER_STATUSES.has(status);
}

/**
 * Kiểm tra xem việc chuyển từ `from` sang `to` có hợp lệ theo state machine hay không.
 * - Không cho phép chuyển tới chính trạng thái hiện tại (self-transition).
 * - Không cho phép chuyển từ terminal status.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return false;
  }
  const allowed = allowedTransitions(from);
  return allowed.includes(to);
}

/**
 * Xác thực transition; nếu không hợp lệ sẽ ném `InvalidOrderTransitionException` (HTTP 409 Conflict).
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidOrderTransitionException(from, to, allowedTransitions(from));
  }
}

/**
 * Kiểm tra vai trò của Actor có quyền thực hiện transition cụ thể hay không theo ALLOWED_TRANSITION_ACTORS.
 */
export function canActorPerformTransition(
  role: UserRole | 'SYSTEM' | 'PAYMENT' | string | undefined,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (!canTransition(from, to)) {
    return false;
  }

  if (!role) {
    return false;
  }

  const allowedActors = ALLOWED_TRANSITION_ACTORS[from]?.[to];
  if (!allowedActors) {
    return false;
  }

  return (allowedActors as readonly string[]).includes(role);
}

/**
 * Xác thực đồng thời cả State Machine transition và Actor Authorization.
 * - Ném `InvalidOrderTransitionException` (409) nếu transition không hợp lệ.
 * - Ném `OrderActionForbiddenException` (403) nếu vai trò không có quyền thực hiện.
 */
export function assertActorTransition(
  role: UserRole | 'SYSTEM' | 'PAYMENT' | string | undefined,
  from: OrderStatus,
  to: OrderStatus,
): void {
  assertTransition(from, to);

  if (!canActorPerformTransition(role, from, to)) {
    throw new OrderActionForbiddenException(role || 'UNKNOWN', from, to);
  }
}
