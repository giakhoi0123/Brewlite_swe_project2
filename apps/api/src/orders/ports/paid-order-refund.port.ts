import { Prisma } from '@prisma/client';

export const PAID_ORDER_REFUND_PORT = Symbol('PAID_ORDER_REFUND_PORT');

export interface PaidOrderRefundResult {
  refundId: string;
  paymentId: string;
  amount: Prisma.Decimal;
  status: 'REFUNDED';
  alreadyRefunded: boolean;
}

/**
 * Payment-owned boundary used by Orders while Orders owns the transaction.
 * Implementations must persist or replay the refund using the supplied tx and
 * must never open or commit a separate transaction.
 */
export interface PaidOrderRefundPort {
  refundPaidOrderInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      actorId: string;
      reason?: string;
    },
  ): Promise<PaidOrderRefundResult>;
}
