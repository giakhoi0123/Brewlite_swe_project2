import { Award, GraduationCap, Sprout } from 'lucide-react';

const FEATURES = [
  {
    icon: Award,
    iconClass: 'bg-primary text-on-primary',
    title: 'Cà phê mộc 100%',
    text: 'Rang mộc thủ công tại xưởng Cầu Đất & Buôn Ma Thuột, không hương liệu tẩm ướp phụ gia.',
  },
  {
    icon: Sprout,
    iconClass: 'bg-secondary text-on-secondary',
    title: 'Trà hoa & Quả tươi',
    text: 'Cốt trà ủ mới mỗi 4 giờ, trái cây tươi tự nhiên giã tay và sơ chế sạch sẽ trong ngày.',
  },
  {
    icon: GraduationCap,
    iconClass: 'bg-primary-container text-on-primary',
    title: 'Đồng hành Gen-Z',
    text: 'Mức giá thân thiện từ 25k - 45k, tích điểm thành viên và miễn phí nâng size giờ vàng học sinh.',
  },
];

export const MenuFeatures: React.FC = () => (
  <section className="w-full bg-surface-container-low py-space-xl">
    <div className="max-w-[1200px] mx-auto px-margin md:px-margin-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter md:gap-gutter-lg">
        {FEATURES.map(({ icon: Icon, iconClass, title, text }) => (
          <div key={title} className="flex items-start gap-space-sm p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display text-headline-sm text-on-surface mb-1">{title}</h4>
              <p className="text-body-sm text-on-surface-variant">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
