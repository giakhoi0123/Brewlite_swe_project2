import type { Metadata } from 'next';
import { ApiProductDetail } from '../../../components/product-detail/ApiProductDetail';

interface ProductPageProps {
  params: { slug: string };
}

export const metadata: Metadata = { title: 'Chi tiết món — BrewLite' };

export default function ProductPage({ params }: ProductPageProps) {
  return <ApiProductDetail key={params.slug} id={params.slug} />;
}
