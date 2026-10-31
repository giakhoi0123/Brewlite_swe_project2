import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetailView } from '../../../components/product-detail/ProductDetailView';
import { getProductBySlug, MOCK_PRODUCTS } from '../../../data/menu-products';

interface ProductPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return MOCK_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export function generateMetadata({ params }: ProductPageProps): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return { title: 'Không tìm thấy món — BrewLite' };
  return {
    title: `${product.name} — BrewLite`,
    description: product.description,
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  // key: khi chuyển sang món khác (từ "Có thể bạn sẽ thích") thì reset toàn bộ lựa chọn và ảnh đang xem.
  return <ProductDetailView key={product.id} product={product} allProducts={MOCK_PRODUCTS} />;
}
