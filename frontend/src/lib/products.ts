import { API_BASE_URL } from "./api";
import { parseProducts } from "./product-contract";
import type { Product } from "@/types/product";
import type { ProductDetail } from "@/types/product-detail";

export async function fetchProducts(signal: AbortSignal): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/products`, {
    signal,
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Unable to load products");
  const data: unknown = await response.json();
  return parseProducts(data);
}

export async function fetchProductDetail(id: string, signal?: AbortSignal): Promise<ProductDetail> {
  const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
    signal,
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Sản phẩm không tồn tại");
    throw new Error("Không thể tải thông tin chi tiết sản phẩm");
  }
  return response.json();
}
