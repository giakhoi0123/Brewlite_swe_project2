import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CheckoutPage from "../page";
import { useAuth } from "../../../components/auth/AuthProvider";
import { useCart } from "../../../components/cart/CartProvider";
import * as checkoutApi from "../../../services/checkout-api";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/checkout",
}));
jest.mock("../../../services/checkout-api");
jest.mock("../../../components/auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));
jest.mock("../../../components/cart/CartProvider", () => ({
  useCart: jest.fn(),
}));

const mockUser = {
  id: "user-uuid-1",
  email: "customer@brewlite.test",
  fullName: "Khách hàng thử nghiệm",
  role: "CUSTOMER" as const,
};

const mockCartItem = {
  lineId: "line-1",
  productId: "a0000000-0000-0000-0000-000000000001",
  name: "Cà phê đen đá",
  imageUrl: "https://example.com/coffee.jpg",
  basePrice: 25000,
  unitPrice: 25000,
  quantity: 2,
  customization: {
    size: "b0000000-0000-0000-0000-000000000001",
    sugar: "100",
    ice: "100",
    toppingIds: [],
  },
};

describe("CheckoutPage", () => {
  const mockClearCart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      token: "jwt-token-123",
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

  it("renders login prompt when user is not logged in", () => {
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

    expect(
      screen.getByText("Yêu cầu đăng nhập để thanh toán"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Đăng nhập ngay" }),
    ).toHaveAttribute("href", "/login?redirect=/checkout");
  });

  it("renders empty cart message when cart is empty", () => {
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

    expect(screen.getByText("Giỏ hàng của bạn đang trống")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Khám phá thực đơn" }),
    ).toBeInTheDocument();
  });

  it("renders cart items and summary for authenticated user with items", () => {
    render(<CheckoutPage />);

    expect(screen.getByText("Xác nhận thanh toán")).toBeInTheDocument();
    expect(screen.getByText("Cà phê đen đá")).toBeInTheDocument();
    expect(screen.getByText("Khách hàng thử nghiệm")).toBeInTheDocument();
    expect(screen.queryByText("Phí giao hàng:")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /THANH TOÁN QUA VNPAY.*50\.000/i }),
    ).toBeInTheDocument();
  });

  it("processes payment successfully on 200 PAID, clears cart, and shows order confirmation", async () => {
    (checkoutApi.createOrderApi as jest.Mock).mockResolvedValue({
      id: "ord-10000000-0000-4000-8000-000000000001",
      status: "PENDING",
      subtotal: 50000,
      discount: 0,
      shippingFee: 15000,
      total: 65000,
      createdAt: new Date().toISOString(),
    });

    (checkoutApi.processPaymentApi as jest.Mock).mockResolvedValue({
      paymentId: "pay-30000000-0000-4000-8000-000000000001",
      orderId: "ord-10000000-0000-4000-8000-000000000001",
      method: "VNPAY",
      amount: 65000,
      paymentStatus: "PAID",
      orderStatus: "PAID",
      resultCode: "PAYMENT_PAID",
      retryable: false,
      processedAt: new Date().toISOString(),
    });

    render(<CheckoutPage />);

    const submitBtn = screen.getByRole("button", {
      name: /THANH TOÁN QUA VNPAY/i,
    });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(checkoutApi.createOrderApi).toHaveBeenCalledWith(
        {
          items: [
            {
              productId: mockCartItem.productId,
              quantity: 2,
              selectedOptions: [mockCartItem.customization.size],
            },
          ],
          voucherCode: undefined,
        },
        "jwt-token-123",
      );
      expect(checkoutApi.processPaymentApi).toHaveBeenCalledWith(
        "ord-10000000-0000-4000-8000-000000000001",
        "VNPAY",
        expect.any(String),
        "jwt-token-123",
      );
      expect(mockClearCart).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Đặt hàng thành công!")).toBeInTheDocument();
    expect(
      screen.getByText("ord-10000000-0000-4000-8000-000000000001"),
    ).toBeInTheDocument();
  });

  it("handles 402 payment failure, shows error and allows retry without clearing cart", async () => {
    (checkoutApi.createOrderApi as jest.Mock).mockResolvedValue({
      id: "ord-123",
      status: "PENDING",
      subtotal: 50000,
      discount: 0,
      shippingFee: 15000,
      total: 65000,
      createdAt: new Date().toISOString(),
    });

    (checkoutApi.processPaymentApi as jest.Mock)
      .mockResolvedValueOnce({
        paymentId: "pay-123",
        orderId: "ord-123",
        method: "VNPAY",
        amount: 65000,
        paymentStatus: "FAILED",
        orderStatus: "PAYMENT_FAILED",
        resultCode: "PAYMENT_DECLINED",
        retryable: true,
        processedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        paymentId: "pay-456",
        orderId: "ord-123",
        method: "VNPAY",
        amount: 65000,
        paymentStatus: "PAID",
        orderStatus: "PAID",
        resultCode: "PAYMENT_PAID",
        retryable: false,
        processedAt: new Date().toISOString(),
      });

    render(<CheckoutPage />);

    const submitBtn = screen.getByRole("button", {
      name: /THANH TOÁN QUA VNPAY/i,
    });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Thanh toán chưa hoàn tất")).toBeInTheDocument();
    });

    expect(mockClearCart).not.toHaveBeenCalled();
    const retryButton = screen.getByRole("button", {
      name: /Thử thanh toán lại/i,
    });
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(checkoutApi.createOrderApi).toHaveBeenCalledTimes(1);
      expect(checkoutApi.processPaymentApi).toHaveBeenCalledTimes(2);
      expect(mockClearCart).toHaveBeenCalledTimes(1);
    });
    const firstKey = (checkoutApi.processPaymentApi as jest.Mock).mock
      .calls[0][2];
    const retryKey = (checkoutApi.processPaymentApi as jest.Mock).mock
      .calls[1][2];
    expect((checkoutApi.processPaymentApi as jest.Mock).mock.calls[1][0]).toBe(
      "ord-123",
    );
    expect(retryKey).not.toBe(firstKey);
  });

  it("handles replayed FAILED/PAID outcomes without redirecting to a stale checkoutUrl and retries with a new key", async () => {
    window.sessionStorage.setItem(
      "brewlite.pending-vnpay-checkout",
      JSON.stringify({
        orderId: "ord-prev",
        idempotencyKey: "key-prev",
      }),
    );

    (checkoutApi.processPaymentApi as jest.Mock)
      .mockResolvedValueOnce({
        paymentId: "pay-prev",
        orderId: "ord-prev",
        method: "VNPAY",
        amount: 50000,
        paymentStatus: "FAILED",
        orderStatus: "PAYMENT_FAILED",
        resultCode: "PAYMENT_DECLINED",
        retryable: true,
        processedAt: new Date().toISOString(),
        checkoutUrl: "https://sandbox.vnpayment.vn/stale-url",
        expiresAt: null,
      })
      .mockResolvedValueOnce({
        paymentId: "pay-next",
        orderId: "ord-prev",
        method: "VNPAY",
        amount: 50000,
        paymentStatus: "PAID",
        orderStatus: "PAID",
        resultCode: "PAYMENT_PAID",
        retryable: false,
        processedAt: new Date().toISOString(),
        checkoutUrl: "https://sandbox.vnpayment.vn/stale-url",
        expiresAt: null,
      });

    render(<CheckoutPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /THANH TOÁN QUA VNPAY/i }),
    );
    expect(
      await screen.findByText("Thanh toán chưa hoàn tất"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Thử thanh toán lại/i }),
    );
    expect(await screen.findByText("Đặt hàng thành công!")).toBeInTheDocument();

    expect(checkoutApi.createOrderApi).not.toHaveBeenCalled();
    expect(checkoutApi.processPaymentApi).toHaveBeenCalledTimes(2);
    expect((checkoutApi.processPaymentApi as jest.Mock).mock.calls[0][2]).toBe(
      "key-prev",
    );
    expect(
      (checkoutApi.processPaymentApi as jest.Mock).mock.calls[1][2],
    ).not.toBe("key-prev");
    expect(mockClearCart).toHaveBeenCalledTimes(1);
  });

  it("creates a new order when stored session order belongs to an edited cart", async () => {
    window.sessionStorage.setItem(
      "brewlite.pending-vnpay-checkout",
      JSON.stringify({
        orderId: "ord-stale",
        idempotencyKey: "key-stale",
        cartSignature: "different-cart-signature",
      }),
    );

    (checkoutApi.createOrderApi as jest.Mock).mockResolvedValue({
      id: "ord-fresh",
      status: "PENDING",
      subtotal: 50000,
      discount: 0,
      total: 50000,
      createdAt: new Date().toISOString(),
    });
    (checkoutApi.processPaymentApi as jest.Mock).mockResolvedValue({
      paymentId: "pay-fresh",
      orderId: "ord-fresh",
      method: "VNPAY",
      amount: 50000,
      paymentStatus: "PAID",
      orderStatus: "PAID",
      resultCode: "PAYMENT_PAID",
      retryable: false,
      processedAt: new Date().toISOString(),
      checkoutUrl: null,
      expiresAt: null,
    });

    render(<CheckoutPage />);

    await userEvent.click(
      screen.getByRole("button", { name: /THANH TOÁN QUA VNPAY/i }),
    );
    expect(await screen.findByText("Đặt hàng thành công!")).toBeInTheDocument();

    expect(checkoutApi.createOrderApi).toHaveBeenCalledTimes(1);
    expect(
      (checkoutApi.processPaymentApi as jest.Mock).mock.calls[0][0],
    ).toBe("ord-fresh");
  });

  it("does not show or charge shipping fee (in-store sales)", () => {
    (useCart as jest.Mock).mockReturnValue({
      isReady: true,
      isChecking: false,
      canCheckout: true,
      items: [{ ...mockCartItem, quantity: 4 }],
      totalQuantity: 4,
      totalPrice: 100000,
      voucherCode: null,
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      updateSize: jest.fn(),
      removeItem: jest.fn(),
      clearCart: mockClearCart,
      setVoucherCode: jest.fn(),
    });

    render(<CheckoutPage />);

    expect(screen.queryByText("Phí giao hàng:")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /THANH TOÁN QUA VNPAY.*100\.000/i }),
    ).toBeInTheDocument();
  });
});
