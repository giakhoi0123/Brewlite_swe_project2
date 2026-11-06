import { Product, ProductDetail } from '../types/product';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

export class ProductApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'ProductApiError';
  }
}

export async function fetchProductsFromApi(
  search?: string,
  signal?: AbortSignal,
): Promise<Product[]> {
  const url = new URL(`${API_BASE_URL}/products`);
  if (search && search.trim()) {
    url.searchParams.set('search', search.trim());
  }

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new ProductApiError(
        `Không thể tải thực đơn (Mã lỗi HTTP: ${response.status})`,
        response.status,
      );
    }

    const data: Product[] = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof ProductApiError) {
      throw error;
    }
    throw new ProductApiError('Lỗi kết nối đến máy chủ BrewLite. Vui lòng thử lại.');
  }
}

export async function fetchProductDetailFromApi(
  id: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  const url = `${API_BASE_URL}/products/${id}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new ProductApiError('Sản phẩm không tồn tại hoặc đã ngừng kinh doanh', 404);
      }
      if (response.status === 400) {
        throw new ProductApiError('Mã sản phẩm không đúng định dạng', 400);
      }
      throw new ProductApiError(`Lỗi máy chủ (${response.status})`, response.status);
    }

    const data: ProductDetail = await response.json();
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof ProductApiError) {
      throw error;
    }
    throw new ProductApiError('Không thể kết nối đến máy chủ để lấy thông tin món.');
  }
}

export interface AvailabilityResult {
  canOrder: boolean;
  items: { index: number; availableQuantity: number; canOrder: boolean }[];
}
export async function checkCartAvailability(items: { productId: string; customization: { size: string; toppingIds: string[] }; quantity: number }[]): Promise<AvailabilityResult> {
  const response = await fetch(API_BASE_URL + '/products/availability', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ items: items.map(i => ({ productId: i.productId, sizeId: i.customization.size, toppingIds: i.customization.toppingIds, quantity: i.quantity })) }),
  });
  if (!response.ok) throw new Error('Không thể kiểm tra nguyên liệu. Vui lòng thử lại.');
  return response.json();
}
