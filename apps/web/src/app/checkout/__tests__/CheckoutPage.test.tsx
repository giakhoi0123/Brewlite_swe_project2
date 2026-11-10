import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutPage from '../page';
import { useAuth } from '../../../components/auth/AuthProvider';
import { useCart } from '../../../components/cart/CartProvider';
import * as checkoutApi from '../../../services/checkout-api';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/checkout',
}));
jest.mock('../../../services/checkout-api');
jest.mock('../../../components/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../../../components/cart/CartProvider', () => ({
  useCart: jest.fn(),
}));

const mockUser = {
  id: 'user-uuid-1',
  email: 'customer@brewlite.test',
  fullName: 'Khách hàng thử nghiệm',
  role: 'CUSTOMER' as const,
};

const mockCartItem = {
  lineId: 'line-1',
  productId: 'a0000000-0000-0000-0000-000000000001',
  name: 'Cà phê đen đá',
  imageUrl: 'https://example.com/coffee.jpg',
  basePrice: 25000,
  unitPrice: 25000,
  quantity: 2,
  customization: {
    size: 'M' as const,
    sugar: '100',
    ice: '100',
    toppingIds: [],
  },
};

describe('CheckoutPage', () => {
  const mockClearCart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      token: 'jwt-token-123',
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    (useCart as jest.Mock).mockReturnValue({
      isReady: true,
      isChecking: false,
      canCheckout: true,
      items: [mockCartItem],
      totalQuantity: 2,
      totalPrice: 50000,
      voucherCode: null,
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      updateSize: jest.fn(),
      removeItem: jest.fn(),
      clearCart: mockClearCart,
      setVoucherCode: jest.fn(),
    });
  });

  it('renders login prompt when user is not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
    });

    render(<CheckoutPage />);

    expect(screen.getByText('Yêu cầu đăng nhập để thanh toán')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập ngay' })).toHaveAttribute(
      'href',
      '/login?redirect=/checkout',
    );
  });

  it('renders empty cart message when cart is empty', () => {
    (useCart as jest.Mock).mockReturnValue({
      isReady: true,
      items: [],
      totalQuantity: 0,
      totalPrice: 0,
      voucherCode: null,
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      updateSize: jest.fn(),
      removeItem: jest.fn(),
      clearCart: mockClearCart,
      setVoucherCode: jest.fn(),
    });

    render(<CheckoutPage />);

    expect(screen.getByText('Giỏ hàng của bạn đang trống')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Khám phá thực đơn' })).toBeInTheDocument();
  });

  it('renders cart items and summary for authenticated user with items', () => {
    render(<CheckoutPage />);

    expect(screen.getByText('Xác nhận thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Cà phê đen đá')).toBeInTheDocument();
    expect(screen.getByText('Khách hàng thử nghiệm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /XÁC NHẬN THANH TOÁN/i })).toBeInTheDocument();
  });

  it('processes payment successfully on 200 PAID, clears cart, and shows order confirmation', async () => {
    (checkoutApi.createOrderApi as jest.Mock).mockResolvedValue({
      id: 'ord-10000000-0000-4000-8000-000000000001',
      status: 'PENDING',
      subtotal: 50000,
      discount: 0,
      total: 65000,
      createdAt: new Date().toISOString(),
    });

    (checkoutApi.processPaymentApi as jest.Mock).mockResolvedValue({
      paymentId: 'pay-30000000-0000-4000-8000-000000000001',
      orderId: 'ord-10000000-0000-4000-8000-000000000001',
      method: 'WALLET',
      amount: 65000,
      paymentStatus: 'PAID',
      orderStatus: 'PAID',
      resultCode: 'PAYMENT_PAID',
      retryable: false,
      processedAt: new Date().toISOString(),
    });

    render(<CheckoutPage />);

    const submitBtn = screen.getByRole('button', { name: /XÁC NHẬN THANH TOÁN/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(checkoutApi.createOrderApi).toHaveBeenCalled();
      expect(checkoutApi.processPaymentApi).toHaveBeenCalledWith(
        'ord-10000000-0000-4000-8000-000000000001',
        'WALLET',
        expect.any(String),
        'jwt-token-123',
        expect.any(String),
      );
      expect(mockClearCart).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Đặt hàng thành công!')).toBeInTheDocument();
    expect(
      screen.getByText('ord-10000000-0000-4000-8000-000000000001'),
    ).toBeInTheDocument();
  });

  it('handles 402 payment failure, shows error and allows retry without clearing cart', async () => {
    (checkoutApi.createOrderApi as jest.Mock).mockResolvedValue({
      id: 'ord-123',
      status: 'PENDING',
      subtotal: 50000,
      discount: 0,
      total: 65000,
      createdAt: new Date().toISOString(),
    });

    (checkoutApi.processPaymentApi as jest.Mock).mockResolvedValue({
      paymentId: 'pay-123',
      orderId: 'ord-123',
      method: 'WALLET',
      amount: 65000,
      paymentStatus: 'FAILED',
      orderStatus: 'PAYMENT_FAILED',
      resultCode: 'PAYMENT_DECLINED',
      retryable: true,
      processedAt: null,
    });

    render(<CheckoutPage />);

    const submitBtn = screen.getByRole('button', { name: /XÁC NHẬN THANH TOÁN/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Thanh toán chưa hoàn tất')).toBeInTheDocument();
    });

    expect(mockClearCart).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Thử thanh toán lại/i })).toBeInTheDocument();
  });
});
