import { fetchProductsFromApi, fetchProductDetailFromApi, ProductApiError } from '../product-api';

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
  });
});
