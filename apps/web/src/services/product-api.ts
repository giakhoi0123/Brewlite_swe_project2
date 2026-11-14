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

export interface AvailabilityItemResult {
  index: number;
  productId: string;
  sizeId: string;
  requestedQuantity: number;
  availableQuantity: number;
  canOrder: boolean;
}

export interface AvailabilityResult {
  canOrder: boolean;
  items: AvailabilityItemResult[];
}

export interface CheckCartAvailabilityItem {
  productId: string;
  customization: {
    size: string;
    toppingIds: string[];
  };
  quantity: number;
}

export async function fetchProductsFromApi(
  search?: string,
  signal?: AbortSignal,
): Promise<Product[]> {
  const query =
    search && search.trim()
      ? `?${new URLSearchParams({ search: search.trim() }).toString()}`
      : '';
  const url = `${API_BASE_URL}/products${query}`;

  try {
    const response = await fetch(url, {
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

export async function checkCartAvailability(
  items: CheckCartAvailabilityItem[],
  signal?: AbortSignal,
): Promise<AvailabilityResult> {
  const url = `${API_BASE_URL}/products/availability`;

  const payload = {
    items: items.map((i) => ({
      productId: i.productId,
      sizeId: i.customization.size,
      toppingIds: i.customization.toppingIds,
      quantity: i.quantity,
    })),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new ProductApiError('Tùy chọn không hợp lệ hoặc thiếu kích cỡ', 400);
      }
      throw new ProductApiError(`Lỗi máy chủ (${response.status})`, response.status);
    }

    const data = await response.json();

    if (
      !data ||
      typeof data.canOrder !== 'boolean' ||
      !Array.isArray(data.items)
    ) {
      throw new ProductApiError(
        'Phản hồi kiểm tra nguyên liệu từ máy chủ không đúng định dạng',
        500,
      );
    }

    for (const item of data.items) {
      if (
        !item ||
        typeof item.index !== 'number' ||
        !Number.isInteger(item.index) ||
        item.index < 0 ||
        typeof item.productId !== 'string' ||
        typeof item.sizeId !== 'string' ||
        typeof item.requestedQuantity !== 'number' ||
        !Number.isInteger(item.requestedQuantity) ||
        item.requestedQuantity <= 0 ||
        typeof item.availableQuantity !== 'number' ||
        !Number.isInteger(item.availableQuantity) ||
        item.availableQuantity < 0 ||
        typeof item.canOrder !== 'boolean'
      ) {
        throw new ProductApiError(
          'Dữ liệu dòng kiểm tra nguyên liệu không đúng định dạng',
          500,
        );
      }
    }

    return {
      canOrder: data.canOrder,
      items: data.items.map((item: any) => ({
        index: item.index,
        productId: item.productId,
        sizeId: item.sizeId,
        requestedQuantity: item.requestedQuantity,
        availableQuantity: item.availableQuantity,
        canOrder: item.canOrder,
      })),
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof ProductApiError) {
      throw error;
    }
    throw new ProductApiError('Không thể kết nối đến máy chủ để kiểm tra nguyên liệu.');
  }
}
