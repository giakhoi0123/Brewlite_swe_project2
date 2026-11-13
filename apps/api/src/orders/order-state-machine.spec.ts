import { OrderStatus, UserRole } from '@prisma/client';
import {
  allowedTransitions,
  assertActorTransition,
  assertTransition,
  canActorPerformTransition,
  canTransition,
  InvalidOrderTransitionException,
  isTerminalStatus,
  OrderActionForbiddenException,
} from './order-state-machine';

describe('Order State Machine (Unit Tests - Pure Logic)', () => {
  describe('1. Valid Transitions', () => {
    it.each([
      [OrderStatus.PENDING, OrderStatus.PAID],
      [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED],
      [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING],
      [OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
      [OrderStatus.PAID, OrderStatus.PREPARING],
      [OrderStatus.PREPARING, OrderStatus.READY],
      [OrderStatus.READY, OrderStatus.COMPLETED],
    ])('allows valid transition from %s to %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    });
  });

  describe('2. State-skipping and backward transitions are rejected', () => {
    it.each([
      [OrderStatus.PENDING, OrderStatus.PREPARING],
      [OrderStatus.PENDING, OrderStatus.READY],
      [OrderStatus.PENDING, OrderStatus.COMPLETED],
      [OrderStatus.PAID, OrderStatus.READY],
      [OrderStatus.PAID, OrderStatus.COMPLETED],
      [OrderStatus.PREPARING, OrderStatus.COMPLETED],
      [OrderStatus.PREPARING, OrderStatus.PAID],
      [OrderStatus.READY, OrderStatus.PREPARING],
      [OrderStatus.READY, OrderStatus.PAID],
    ])('rejects skipped or backward transition from %s to %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(
        InvalidOrderTransitionException,
      );
    });
  });

  describe('3. Terminal state COMPLETED cannot transition to any state', () => {
    it('verifies COMPLETED is marked as terminal', () => {
      expect(isTerminalStatus(OrderStatus.COMPLETED)).toBe(true);
      expect(allowedTransitions(OrderStatus.COMPLETED)).toHaveLength(0);
    });

    it.each(Object.values(OrderStatus))(
      'cannot transition from COMPLETED to %s',
      (targetStatus) => {
        expect(canTransition(OrderStatus.COMPLETED, targetStatus)).toBe(false);
        expect(() =>
          assertTransition(OrderStatus.COMPLETED, targetStatus),
        ).toThrow(InvalidOrderTransitionException);
      },
    );
  });

  describe('4. Terminal state CANCELLED cannot transition to any state', () => {
    it('verifies CANCELLED is marked as terminal', () => {
      expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
      expect(allowedTransitions(OrderStatus.CANCELLED)).toHaveLength(0);
    });

    it.each(Object.values(OrderStatus))(
      'cannot transition from CANCELLED to %s',
      (targetStatus) => {
        expect(canTransition(OrderStatus.CANCELLED, targetStatus)).toBe(false);
        expect(() =>
          assertTransition(OrderStatus.CANCELLED, targetStatus),
        ).toThrow(InvalidOrderTransitionException);
      },
    );
  });

  describe('5. Self-transitions are rejected for all states', () => {
    it.each(Object.values(OrderStatus))(
      'cannot transition from %s to itself',
      (status) => {
        expect(canTransition(status, status)).toBe(false);
        expect(() => assertTransition(status, status)).toThrow(
          InvalidOrderTransitionException,
        );
      },
    );
  });

  describe('6. PENDING cancellation rule', () => {
    it('allows PENDING to transition to CANCELLED', () => {
      expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
      expect(() =>
        assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED),
      ).not.toThrow();
    });
  });

  describe('7. PAID cannot be cancelled', () => {
    it('rejects direct transition from PAID to CANCELLED', () => {
      expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
      expect(() =>
        assertTransition(OrderStatus.PAID, OrderStatus.CANCELLED),
      ).toThrow(InvalidOrderTransitionException);
    });
  });

  describe('8. PAYMENT_FAILED can transition to PENDING (retry) or CANCELLED', () => {
    it('allows retry: PAYMENT_FAILED -> PENDING', () => {
      expect(
        canTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING),
      ).toBe(true);
      expect(() =>
        assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING),
      ).not.toThrow();
    });

    it('allows abandonment: PAYMENT_FAILED -> CANCELLED', () => {
      expect(
        canTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED),
      ).toBe(true);
      expect(() =>
        assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED),
      ).not.toThrow();
    });

    it('rejects illegal jump: PAYMENT_FAILED -> PAID without going through PENDING', () => {
      expect(canTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID)).toBe(
        false,
      );
      expect(() =>
        assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PAID),
      ).toThrow(InvalidOrderTransitionException);
    });
  });

  describe('9. Exception details check', () => {
    it('includes fromStatus, toStatus, and allowed list in exception', () => {
      try {
        assertTransition(OrderStatus.PENDING, OrderStatus.READY);
        fail('Should have thrown InvalidOrderTransitionException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InvalidOrderTransitionException);
        expect(err.getStatus()).toBe(409);
        expect(err.from).toBe(OrderStatus.PENDING);
        expect(err.to).toBe(OrderStatus.READY);
        expect(err.allowed).toEqual([
          OrderStatus.PAID,
          OrderStatus.PAYMENT_FAILED,
          OrderStatus.CANCELLED,
        ]);
        expect(err.message).toContain('PENDING');
        expect(err.message).toContain('READY');
      }
    });
  });

  describe('10. RBAC Transition Matrix (Section I, II, III)', () => {
    it('allows SYSTEM and PAYMENT for PENDING -> PAID', () => {
      expect(canActorPerformTransition('SYSTEM', OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
      expect(canActorPerformTransition('PAYMENT', OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
    });

    it('forbids CUSTOMER and BARISTA from PENDING -> PAID', () => {
      expect(canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.PENDING, OrderStatus.PAID)).toBe(false);
      expect(canActorPerformTransition(UserRole.BARISTA, OrderStatus.PENDING, OrderStatus.PAID)).toBe(false);
      expect(() =>
        assertActorTransition(UserRole.CUSTOMER, OrderStatus.PENDING, OrderStatus.PAID),
      ).toThrow(OrderActionForbiddenException);
    });

    it('forbids CUSTOMER from all Barista steps', () => {
      expect(canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.PAID, OrderStatus.PREPARING)).toBe(false);
      expect(canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.PREPARING, OrderStatus.READY)).toBe(false);
      expect(canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.READY, OrderStatus.COMPLETED)).toBe(false);
    });

    it('allows BARISTA and MANAGER for Barista workflow steps', () => {
      for (const role of [UserRole.BARISTA, UserRole.MANAGER]) {
        expect(canActorPerformTransition(role, OrderStatus.PAID, OrderStatus.PREPARING)).toBe(true);
        expect(canActorPerformTransition(role, OrderStatus.PREPARING, OrderStatus.READY)).toBe(true);
        expect(canActorPerformTransition(role, OrderStatus.READY, OrderStatus.COMPLETED)).toBe(true);
      }
    });

    it('allows CUSTOMER and MANAGER to cancel PENDING order', () => {
      expect(canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
      expect(canActorPerformTransition(UserRole.MANAGER, OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
      expect(canActorPerformTransition(UserRole.BARISTA, OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(false);
    });
  });
});
