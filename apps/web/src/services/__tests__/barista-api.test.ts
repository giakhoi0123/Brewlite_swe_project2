import {
  fetchBaristaOrdersApi,
  transitionOrderStatusApi,
  BaristaApiError,
} from '../barista-api';

describe('barista-api service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchBaristaOrdersApi', () => {
    it('fetches queue successfully and maps order items and customer', async () => {
      const mockResponse = {
        data: [
          {
            id: 'ord-123',
            orderNumber: 'BL-1001',
            status: 'PAID',
            total: 75000,
            createdAt: '2026-11-10T10:00:00.000Z',
            customer: { id: 'cust-1', fullName: 'Nguyen Van A' },
            items: [
              {
                id: 'it-1',
                productName: 'Cà phê đen đá',
                quantity: 2,
                options: [
                  { id: 'opt-1', name: 'Size L', type: 'SIZE', extraPrice: 6000 },
                  { id: 'opt-2', name: 'Thạch cà phê', type: 'TOPPING', extraPrice: 10000 },
                ],
                notes: 'Ít ngọt',
              },
            ],
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const orders = await fetchBaristaOrdersApi('mock-jwt-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/barista/orders'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
        }),
      );
      expect(orders).toHaveLength(1);
      expect(orders[0]).toEqual({
        id: 'ord-123',
        orderNumber: 'BL-1001',
        status: 'PAID',
        total: 75000,
        createdAt: '2026-11-10T10:00:00.000Z',
        customerName: 'Nguyen Van A',
        items: [
          {
            id: 'it-1',
            productName: 'Cà phê đen đá',
            quantity: 2,
            size: 'Size L',
            toppings: ['Thạch cà phê'],
            notes: 'Ít ngọt',
          },
        ],
      });
    });

    it('throws FORBIDDEN when 403 occurs', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Forbidden' }),
      });

      await expect(fetchBaristaOrdersApi('customer-token')).rejects.toThrow(
        BaristaApiError,
      );
    });

    it('throws MODULE_PENDING_HANDOFF on 404 or 501', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Not Found' }),
      });

      await expect(fetchBaristaOrdersApi('token')).rejects.toMatchObject({
        code: 'MODULE_PENDING_HANDOFF',
      });
    });
  });

  describe('transitionOrderStatusApi', () => {
    it('calls POST /barista/orders/:id/accept when nextStatus is PREPARING', async () => {
      const mockResult = {
        id: 'ord-123',
        orderNumber: 'BL-1001',
        status: 'PREPARING',
        total: 75000,
        createdAt: '2026-11-10T10:00:00.000Z',
        items: [],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResult,
      });

      const res = await transitionOrderStatusApi('ord-123', 'PREPARING', 'jwt-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/barista\/orders\/ord-123\/accept$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-token',
          }),
        }),
      );
      expect(res.status).toBe('PREPARING');
    });

    it('calls POST /barista/orders/:id/ready when nextStatus is READY', async () => {
      const mockResult = {
        id: 'ord-123',
        status: 'READY',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResult,
      });

      const res = await transitionOrderStatusApi('ord-123', 'READY', 'jwt-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/barista\/orders\/ord-123\/ready$/),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(res.status).toBe('READY');
    });

    it('calls POST /barista/orders/:id/complete when nextStatus is COMPLETED', async () => {
      const mockResult = {
        id: 'ord-123',
        status: 'COMPLETED',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResult,
      });

      const res = await transitionOrderStatusApi('ord-123', 'COMPLETED', 'jwt-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/barista\/orders\/ord-123\/complete$/),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(res.status).toBe('COMPLETED');
    });
  });
});
