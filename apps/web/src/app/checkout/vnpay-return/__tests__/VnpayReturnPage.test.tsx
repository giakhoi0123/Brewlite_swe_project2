import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import VnpayReturnPage from "../page";
import { useAuth } from "../../../../components/auth/AuthProvider";
import { useCart } from "../../../../components/cart/CartProvider";
import * as checkoutApi from "../../../../services/checkout-api";

jest.mock("../../../../services/checkout-api", () => {
  const actual = jest.requireActual("../../../../services/checkout-api");
  return {
    ...actual,
    getPaymentStatusApi: jest.fn(),
  };
});
jest.mock("../../../../components/auth/AuthProvider", () => ({
  useAuth: jest.fn(),
}));
jest.mock("../../../../components/cart/CartProvider", () => ({
  useCart: jest.fn(),
}));

describe("VnpayReturnPage", () => {
  const mockClearCart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState(
      {},
      "",
      "/checkout/vnpay-return?valid=true&responseCode=24&paymentId=pay-failed-1",
    );

    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user-1", email: "c@test.com", fullName: "Khách", role: "CUSTOMER" },
      token: "jwt-token",
      loading: false,
    });
    (useCart as jest.Mock).mockReturnValue({
      clearCart: mockClearCart,
    });
  });

  it("shows failed status and preserves orderId for retry when cancelled payment returns FAILED", async () => {
    window.sessionStorage.setItem(
      "brewlite.pending-vnpay-checkout",
      JSON.stringify({
        orderId: "ord-1",
        idempotencyKey: "key-1",
        paymentId: "pay-failed-1",
        cartSignature: "sig-1",
      }),
    );

    (checkoutApi.getPaymentStatusApi as jest.Mock).mockResolvedValue({
      paymentId: "pay-failed-1",
      orderId: "ord-1",
      method: "VNPAY",
      amount: 79000,
      paymentStatus: "FAILED",
      orderStatus: "PAYMENT_FAILED",
      resultCode: "PAYMENT_DECLINED",
      retryable: true,
      processedAt: "2026-11-16T14:00:00.000Z",
      checkoutUrl: null,
      expiresAt: null,
    });

    render(<VnpayReturnPage />);

    expect(
      await screen.findByText("Thanh toán chưa hoàn tất"),
    ).toBeInTheDocument();
    expect(screen.getByText(/79\.000/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Thử thanh toán lại" }),
    ).toHaveAttribute("href", "/checkout");
    expect(mockClearCart).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(
        JSON.parse(
          window.sessionStorage.getItem("brewlite.pending-vnpay-checkout") ||
            "{}",
        ),
      ).toEqual({
        orderId: "ord-1",
        cartSignature: "sig-1",
      });
    });
  });

  it("stops spinner and renders error state when status polling fails", async () => {
    (checkoutApi.getPaymentStatusApi as jest.Mock).mockRejectedValue(
      new checkoutApi.CheckoutApiError("Không thể đọc trạng thái thanh toán (HTTP 500)", 500),
    );

    render(<VnpayReturnPage />);

    expect(
      await screen.findByText("Thanh toán chưa hoàn tất"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Không thể đọc trạng thái thanh toán (HTTP 500)"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Đang xác nhận VNPay"),
    ).not.toBeInTheDocument();
  });
});
