import {
  fetchProductsFromApi,
  fetchProductDetailFromApi,
  checkCartAvailability,
  ProductApiError,
} from '../product-api';

describe('product-api service', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchProductsFromApi', () => {
    it('fetches products successfully', async () => {
      const mockData = [{ id: '1', name: 'Trà sen', basePrice: 45000, isAvailable: true, imageUrl: '' }];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await fetchProductsFromApi();
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products'),
        expect.any(Object),
      );
    });

    it('appends search query when provided', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await fetchProductsFromApi('cà phê');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products?search=c%C3%A0+ph%C3%AA'),
        expect.any(Object),
      );
    });

    it('throws ProductApiError when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchProductsFromApi()).rejects.toThrow(ProductApiError);
    });

    it('normalizes network failures into an actionable ProductApiError', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(fetchProductsFromApi()).rejects.toMatchObject({
        name: 'ProductApiError',
        message: 'Lỗi kết nối đến máy chủ BrewLite. Vui lòng thử lại.',
      });
    });

    it('preserves AbortError so callers can ignore a cancelled stale request', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), {
        name: 'AbortError',
      });
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(fetchProductsFromApi('cà phê')).rejects.toBe(abortError);
    });
  });

  describe('fetchProductDetailFromApi', () => {
    it('fetches product detail successfully', async () => {
      const mockDetail = {
        id: '1',
        name: 'Trà sen',
        basePrice: 45000,
        isAvailable: true,
        imageUrl: '',
        options: [],
        inventory: { quantity: 10, reserved: 0, availableStock: 10 },
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDetail,
      });

      const result = await fetchProductDetailFromApi('1');
      expect(result).toEqual(mockDetail);
    });

    it('throws specific ProductApiError on 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(fetchProductDetailFromApi('999')).rejects.toThrow(
        'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh',
      );
    });

    it('throws specific ProductApiError on 400', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(fetchProductDetailFromApi('invalid-id')).rejects.toThrow(
        'Mã sản phẩm không đúng định dạng',
      );
    });

    it('normalizes unexpected detail connection failures', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network unavailable'));

      await expect(fetchProductDetailFromApi('prod-001')).rejects.toMatchObject({
        name: 'ProductApiError',
        message: 'Không thể kết nối đến máy chủ để lấy thông tin món.',
      });
    });
  });

  describe('checkCartAvailability', () => {
    const mockCanonicalResult = {
      canOrder: true,
      items: [
        {
          index: 0,
          productId: 'prod-001',
          sizeId: 'size-m',
          requestedQuantity: 2,
          availableQuantity: 10,
          canOrder: true,
        },
      ],
    };

    const inputItems = [
      {
        productId: 'prod-001',
        customization: {
          size: 'size-m',
          toppingIds: ['top-1', 'top-2'],
        },
        quantity: 2,
      },
    ];

    it('1. calls the exact canonical endpoint POST /products/availability', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCanonicalResult,
      });

      await checkCartAvailability(inputItems);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/products\/availability$/),
        expect.objectContaining({
          method: 'POST',
          cache: 'no-store',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('2. body correctly structures { items: [...] } without extra fields', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCanonicalResult,
      });

      await checkCartAvailability(inputItems);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const parsedBody = JSON.parse(callArgs[1].body);

      expect(parsedBody).toEqual({
        items: [
          {
            productId: 'prod-001',
            sizeId: 'size-m',
            toppingIds: ['top-1', 'top-2'],
            quantity: 2,
          },
        ],
      });
      expect(parsedBody.items[0]).not.toHaveProperty('notes');
      expect(parsedBody.items[0]).not.toHaveProperty('unitPrice');
      expect(parsedBody.items[0]).not.toHaveProperty('userId');
    });

    it('3. passes AbortSignal directly to fetch', async () => {
      const controller = new AbortController();
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCanonicalResult,
      });

      await checkCartAvailability(inputItems, controller.signal);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        }),
      );
    });

    it('4. parses canonical response accurately', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCanonicalResult,
      });

      const result = await checkCartAvailability(inputItems);

      expect(result).toEqual(mockCanonicalResult);
      expect(result.canOrder).toBe(true);
      expect(result.items[0].availableQuantity).toBe(10);
    });

    it('5. rejects malformed response without canOrder boolean or items array', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: true }),
      });

      await expect(checkCartAvailability(inputItems)).rejects.toMatchObject({
        name: 'ProductApiError',
        statusCode: 500,
        message: 'Phản hồi kiểm tra nguyên liệu từ máy chủ không đúng định dạng',
      });
    });

    it('5b. rejects response when items contain invalid item structure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          canOrder: true,
          items: [{ index: 0, productId: 'p1' }], // missing required fields
        }),
      });

      await expect(checkCartAvailability(inputItems)).rejects.toMatchObject({
        name: 'ProductApiError',
        statusCode: 500,
        message: 'Dữ liệu dòng kiểm tra nguyên liệu không đúng định dạng',
      });
    });

    it('6. safely handles HTTP error responses without leaking internal stack traces', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(checkCartAvailability(inputItems)).rejects.toMatchObject({
        name: 'ProductApiError',
        statusCode: 400,
        message: 'Tùy chọn không hợp lệ hoặc thiếu kích cỡ',
      });
    });

    it('7. rethrows AbortError verbatim so component can ignore stale cancellations', async () => {
      const abortError = Object.assign(new Error('Operation aborted'), {
        name: 'AbortError',
      });
      global.fetch = jest.fn().mockRejectedValue(abortError);

      await expect(checkCartAvailability(inputItems)).rejects.toBe(abortError);
    });
  });
});
