import {
  createOrderApi,
  getPaymentStatusApi,
  processPaymentApi,
} from "../checkout-api";

describe("checkout-api service", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("sends only the server-authoritative CreateOrder DTO fields", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        id: "10000000-0000-4000-8000-000000000001",
        status: "PENDING",
        subtotal: 58000,
        discount: 0,
        total: 58000,
        createdAt: "2026-11-12T00:00:00.000Z",
      }),
    });

    await createOrderApi(
      {
        items: [
          {
            productId: "a0000000-0000-0000-0000-000000000001",
            quantity: 2,
            selectedOptions: [
              "b0000000-0000-0000-0000-000000000001",
              "b0000000-0000-0000-0000-000000000002",
            ],
            notes: " Ít đá ",
          },
        ],
        voucherCode: " SAVE10 ",
      },
      "jwt-token",
    );

    const request = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(request.body)).toEqual({
      items: [
        {
          productId: "a0000000-0000-0000-0000-000000000001",
          quantity: 2,
          selectedOptions: [
            "b0000000-0000-0000-0000-000000000001",
            "b0000000-0000-0000-0000-000000000002",
          ],
          notes: "Ít đá",
        },
      ],
      voucherCode: "SAVE10",
    });
    expect(request.headers).toMatchObject({
      Authorization: "Bearer jwt-token",
    });
  });

  it("returns a persisted HTTP 402 decline as a Payment response", async () => {
    const decline = {
      paymentId: "30000000-0000-4000-8000-000000000001",
      orderId: "10000000-0000-4000-8000-000000000001",
      method: "VNPAY",
      amount: 58000,
      paymentStatus: "FAILED",
      orderStatus: "PAYMENT_FAILED",
      resultCode: "PAYMENT_DECLINED",
      retryable: true,
      processedAt: "2026-11-12T00:00:00.000Z",
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => decline,
    });

    await expect(
      processPaymentApi(
        decline.orderId,
        "VNPAY",
        "20000000-0000-4000-8000-000000000001",
        "jwt-token",
      ),
    ).resolves.toEqual(decline);
  });

  it("reads the authenticated persisted VNPay status without caching", async () => {
    const processing = {
      paymentId: "30000000-0000-4000-8000-000000000001",
      orderId: "10000000-0000-4000-8000-000000000001",
      method: "VNPAY",
      amount: 58000,
      paymentStatus: "PROCESSING",
      orderStatus: "PENDING",
      resultCode: "PAYMENT_PROCESSING",
      retryable: false,
      processedAt: null,
      checkoutUrl: null,
      expiresAt: "2026-11-12T03:15:00.000Z",
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => processing,
    });

    await expect(
      getPaymentStatusApi(processing.paymentId, "jwt-token"),
    ).resolves.toEqual(processing);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/payments/${processing.paymentId}`),
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      }),
    );
  });
});
