export const PAYMENT_METHODS = ['WALLET', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['PROCESSING', 'PAID', 'FAILED', 'UNKNOWN'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_ORDER_STATUSES = ['PENDING', 'PAID', 'PAYMENT_FAILED'] as const;
export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export const MOCK_PAYMENT_SCENARIOS = [
  'SUCCESS',
  'FAILURE',
  'PROCESSING',
  'TIMEOUT',
  'UNKNOWN',
] as const;
export type MockPaymentScenario = (typeof MOCK_PAYMENT_SCENARIOS)[number];

export type PaymentResultCode =
  | 'PAYMENT_PAID'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_STATUS_UNKNOWN';

export type PaymentErrorCode =
  | 'INVALID_PAYMENT_REQUEST'
  | 'UNSUPPORTED_PAYMENT_METHOD'
  | 'AUTHENTICATION_REQUIRED'
  | 'ORDER_ACCESS_DENIED'
  | 'ORDER_NOT_FOUND'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'ORDER_ALREADY_PAID'
  | 'ORDER_NOT_PAYABLE'
  | 'PAYMENT_INTERNAL_ERROR';

export interface PaymentRequest {
  orderId: string;
  method: PaymentMethod;
}

export interface PaymentHeaders {
  authorization: `Bearer ${string}`;
  idempotencyKey: string;
  mockScenario?: MockPaymentScenario;
}

export interface PaymentResponse {
  paymentId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  paymentStatus: PaymentStatus;
  orderStatus: PaymentOrderStatus;
  resultCode: PaymentResultCode;
  retryable: boolean;
  processedAt: string | null;
}

export interface PaymentErrorResponse {
  statusCode: number;
  code: PaymentErrorCode;
  message: string;
  retryable: boolean;
}

export interface PaymentResultFixture {
  scenario: MockPaymentScenario;
  headers: PaymentHeaders;
  request: PaymentRequest;
  expectedHttpStatus: 200 | 202 | 402;
  expectedBody: PaymentResponse;
}

export interface PaymentErrorFixture {
  scenario?: MockPaymentScenario;
  headers: Partial<PaymentHeaders>;
  request: PaymentRequest;
  expectedHttpStatus: 400 | 401 | 403 | 404 | 409 | 500;
  expectedBody: PaymentErrorResponse;
}

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const PAID_ORDER_ID = '10000000-0000-4000-8000-000000000002';
const SUCCESS_KEY = '20000000-0000-4000-8000-000000000001';
const FAILURE_KEY = '20000000-0000-4000-8000-000000000002';
const TEST_AUTHORIZATION = 'Bearer test.jwt.token' as const;

const successResponse: PaymentResponse = {
  paymentId: '30000000-0000-4000-8000-000000000001',
  orderId: ORDER_ID,
  method: 'WALLET',
  amount: 58000,
  paymentStatus: 'PAID',
  orderStatus: 'PAID',
  resultCode: 'PAYMENT_PAID',
  retryable: false,
  processedAt: '2026-11-01T08:00:00.000Z',
};

const failureResponse: PaymentResponse = {
  paymentId: '30000000-0000-4000-8000-000000000002',
  orderId: ORDER_ID,
  method: 'CARD',
  amount: 58000,
  paymentStatus: 'FAILED',
  orderStatus: 'PAYMENT_FAILED',
  resultCode: 'PAYMENT_DECLINED',
  retryable: true,
  processedAt: '2026-11-01T08:01:00.000Z',
};

export const PAYMENT_RESULT_FIXTURES = {
  success: {
    scenario: 'SUCCESS',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: SUCCESS_KEY,
      mockScenario: 'SUCCESS',
    },
    request: { orderId: ORDER_ID, method: 'WALLET' },
    expectedHttpStatus: 200,
    expectedBody: successResponse,
  },
  sameKeySamePayload: {
    scenario: 'SUCCESS',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: SUCCESS_KEY,
      mockScenario: 'FAILURE',
    },
    request: { orderId: ORDER_ID, method: 'WALLET' },
    expectedHttpStatus: 200,
    expectedBody: successResponse,
  },
  failure: {
    scenario: 'FAILURE',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: FAILURE_KEY,
      mockScenario: 'FAILURE',
    },
    request: { orderId: ORDER_ID, method: 'CARD' },
    expectedHttpStatus: 402,
    expectedBody: failureResponse,
  },
  sameFailedKeySamePayload: {
    scenario: 'FAILURE',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: FAILURE_KEY,
      mockScenario: 'SUCCESS',
    },
    request: { orderId: ORDER_ID, method: 'CARD' },
    expectedHttpStatus: 402,
    expectedBody: failureResponse,
  },
  processing: {
    scenario: 'PROCESSING',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: '20000000-0000-4000-8000-000000000003',
      mockScenario: 'PROCESSING',
    },
    request: { orderId: ORDER_ID, method: 'WALLET' },
    expectedHttpStatus: 202,
    expectedBody: {
      paymentId: '30000000-0000-4000-8000-000000000003',
      orderId: ORDER_ID,
      method: 'WALLET',
      amount: 58000,
      paymentStatus: 'PROCESSING',
      orderStatus: 'PENDING',
      resultCode: 'PAYMENT_PROCESSING',
      retryable: false,
      processedAt: null,
    },
  },
  timeout: {
    scenario: 'TIMEOUT',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: '20000000-0000-4000-8000-000000000004',
      mockScenario: 'TIMEOUT',
    },
    request: { orderId: ORDER_ID, method: 'CARD' },
    expectedHttpStatus: 202,
    expectedBody: {
      paymentId: '30000000-0000-4000-8000-000000000004',
      orderId: ORDER_ID,
      method: 'CARD',
      amount: 58000,
      paymentStatus: 'UNKNOWN',
      orderStatus: 'PENDING',
      resultCode: 'PAYMENT_STATUS_UNKNOWN',
      retryable: false,
      processedAt: null,
    },
  },
  unknown: {
    scenario: 'UNKNOWN',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: '20000000-0000-4000-8000-000000000005',
      mockScenario: 'UNKNOWN',
    },
    request: { orderId: ORDER_ID, method: 'WALLET' },
    expectedHttpStatus: 202,
    expectedBody: {
      paymentId: '30000000-0000-4000-8000-000000000005',
      orderId: ORDER_ID,
      method: 'WALLET',
      amount: 58000,
      paymentStatus: 'UNKNOWN',
      orderStatus: 'PENDING',
      resultCode: 'PAYMENT_STATUS_UNKNOWN',
      retryable: false,
      processedAt: null,
    },
  },
  retryAfterFailure: {
    scenario: 'SUCCESS',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: '20000000-0000-4000-8000-000000000006',
      mockScenario: 'SUCCESS',
    },
    request: { orderId: ORDER_ID, method: 'CARD' },
    expectedHttpStatus: 200,
    expectedBody: {
      ...successResponse,
      paymentId: '30000000-0000-4000-8000-000000000006',
      method: 'CARD',
      processedAt: '2026-11-01T08:02:00.000Z',
    },
  },
} satisfies Record<string, PaymentResultFixture>;

export const PAYMENT_ERROR_FIXTURES = {
  missingJwt: {
    headers: { idempotencyKey: '20000000-0000-4000-8000-000000000007' },
    request: { orderId: ORDER_ID, method: 'WALLET' },
    expectedHttpStatus: 401,
    expectedBody: {
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'A valid Bearer JWT is required.',
      retryable: false,
    },
  },
  sameKeyDifferentPayload: {
    scenario: 'SUCCESS',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: SUCCESS_KEY,
      mockScenario: 'SUCCESS',
    },
    request: { orderId: ORDER_ID, method: 'CARD' },
    expectedHttpStatus: 409,
    expectedBody: {
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_CONFLICT',
      message: 'Idempotency-Key is already associated with a different payment payload.',
      retryable: false,
    },
  },
  alreadyPaid: {
    scenario: 'SUCCESS',
    headers: {
      authorization: TEST_AUTHORIZATION,
      idempotencyKey: '20000000-0000-4000-8000-000000000008',
      mockScenario: 'SUCCESS',
    },
    request: { orderId: PAID_ORDER_ID, method: 'WALLET' },
    expectedHttpStatus: 409,
    expectedBody: {
      statusCode: 409,
      code: 'ORDER_ALREADY_PAID',
      message: 'The order has already been paid.',
      retryable: false,
    },
  },
} satisfies Record<string, PaymentErrorFixture>;
