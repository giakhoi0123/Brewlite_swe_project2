import Link from 'next/link';
import { ArrowRight, Coffee, Leaf } from 'lucide-react';

const MENU_LINKS = [
  'Cà phê pha máy Espresso',
  'Pour-Over Thủ Công V60',
  'Cà phê Cold Brew ngâm ủ',
  'Hạt cà phê Arabica Cầu Đất',
  'Trà thảo mộc & Bánh thủ công',
];

const STORES = [
  {
    name: 'Flagship Sài Gòn',
    address: '48 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. HCM',
    hours: 'Mở cửa: 07:00 – 22:30',
  },
  {
    name: 'Roastery SoHo',
    address: '12 Phố Nhà Thờ, Hoàn Kiếm, Hà Nội',
    hours: 'Mở cửa: 07:30 – 22:00',
  },
];

export const Footer: React.FC = () => (
  <footer className="w-full bg-surface-container-low pt-space-xl pb-space-lg text-on-surface-variant">
    <div className="max-w-[1200px] mx-auto px-margin md:px-margin-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter-lg pb-space-xl">
        <div className="space-y-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <Coffee className="w-[18px] h-[18px]" />
            </div>
            <span className="font-display text-headline-sm text-primary">BrewLite</span>
          </div>
          <p className="text-body-md pt-space-xs">
            Xưởng rang thủ công và quán cà phê mộc mạc. Mang tinh hoa hạt cà phê cao nguyên đến từng tách
            hương vị dịu êm.
          </p>
          <div className="flex items-center gap-space-xs pt-space-xs text-secondary">
            <Leaf className="w-5 h-5" />
            <span className="font-display text-label-md">100% Thu hái chín mọng &amp; Rang mộc</span>
          </div>
        </div>

        <div className="space-y-space-sm">
          <h3 className="font-display text-headline-sm text-on-surface">Địa chỉ xưởng &amp; Cafe</h3>
          {STORES.map((store) => (
            <div key={store.name} className="space-y-space-xs text-body-sm pb-space-xs">
              <p className="font-display text-label-md text-on-surface">{store.name}</p>
              <p>{store.address}</p>
              <p className="text-outline">{store.hours}</p>
            </div>
          ))}
        </div>

        <div className="space-y-space-sm">
          <h3 className="font-display text-headline-sm text-on-surface">Thực đơn đặc sắc</h3>
          <ul className="space-y-space-xs text-body-md">
            {MENU_LINKS.map((label) => (
              <li key={label}>
                <Link href="/products" className="hover:text-primary transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-space-sm">
          <h3 className="font-display text-headline-sm text-on-surface">Bản tin hương vị</h3>
          <p className="text-body-sm">
            Nhận thông báo mẻ rang mới nhất, câu chuyện người nông dân và ưu đãi độc quyền.
          </p>
          <div className="flex flex-col gap-space-xs">
            <input
              type="email"
              placeholder="Địa chỉ email của bạn"
              aria-label="Email nhận bản tin"
              className="w-full bg-surface-container rounded-full px-space-md py-space-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest transition-colors"
            />
            <button
              type="button"
              className="w-full rounded-full bg-primary text-on-primary font-display text-label-lg py-space-sm hover:scale-[0.98] active:scale-95 transition-transform flex items-center justify-center gap-space-xs shadow-[0_2px_8px_rgba(43,24,16,0.08)]"
            >
              <span>Đăng ký</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md text-body-sm text-outline">
        <p>© 2026 BrewLite Artisanal Coffee Roastery. Tất cả quyền được bảo lưu.</p>
        <div className="flex items-center gap-space-md">
          <Link href="/ve-chung-toi" className="hover:text-on-surface transition-colors">
            Chính sách bảo mật
          </Link>
          <Link href="/ve-chung-toi" className="hover:text-on-surface transition-colors">
            Điều khoản phục vụ
          </Link>
          <Link href="/ve-chung-toi" className="hover:text-on-surface transition-colors">
            Liên hệ hợp tác
          </Link>
        </div>
      </div>
    </div>
  </footer>
);
