import { MenuCatalog } from '../components/MenuCatalog';

export default function HomePage() {
  return (
    <div className="py-4">
      {/* Hero / Banner nhỏ gọn mobile-first */}
      <section className="text-center px-4 py-6 sm:py-8 max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
          Khám phá thực đơn BrewLite
        </h1>
        <p className="mt-2 text-sm sm:text-base text-stone-600">
          Cà phê nguyên chất rang mộc và trà sữa thanh mát cho ngày mới năng lượng
        </p>
      </section>

      {/* Catalog */}
      <MenuCatalog />
    </div>
  );
}

