import type { Metadata } from 'next';
import { ApiMenu } from '../../components/menu/ApiMenu';

export const metadata: Metadata = {
  title: 'Thực đơn — BrewLite',
  description: 'Thực đơn đồ uống BrewLite: cà phê rang mộc, trà trái cây, trà sữa và thức uống giải nhiệt.',
};

interface MenuPageProps {
  searchParams: { q?: string; 'danh-muc'?: string };
}

export default function MenuPage({ searchParams }: MenuPageProps) {
  return <ApiMenu initialSearch={searchParams.q ?? ''} />;
}
