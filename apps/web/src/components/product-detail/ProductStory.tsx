import { Compass, Lightbulb, Shuffle, Wheat } from 'lucide-react';
import { FlavorScore, ProductStory as ProductStoryData } from '../../types/menu';

const BAR_COLORS = ['bg-secondary', 'bg-secondary-container', 'bg-primary-container'];

interface ProductStoryProps {
  productName: string;
  story: ProductStoryData;
  flavor: FlavorScore[];
}

export const ProductStory: React.FC<ProductStoryProps> = ({ productName, story, flavor }) => {
  const cards = [
    { icon: Wheat, iconClass: 'bg-secondary-fixed text-on-secondary-fixed', title: 'Thành phần', text: story.ingredients },
    { icon: Compass, iconClass: 'bg-primary-fixed text-primary-container', title: 'Nguồn gốc nông trại', text: story.origin },
    { icon: Shuffle, iconClass: 'bg-secondary-fixed-dim text-on-secondary-fixed', title: 'Hương vị chủ đạo', text: story.flavor },
    { icon: Lightbulb, iconClass: 'bg-surface-container-high text-on-surface', title: 'Gợi ý thưởng thức', text: story.serving },
  ];

  return (
    <section className="w-full bg-surface-container-low py-space-xl my-space-lg">
      <div className="max-w-[1200px] mx-auto px-margin md:px-margin-md lg:px-margin-lg flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-xs">
          <span className="font-display text-label-md text-secondary uppercase tracking-widest font-bold">
            Artisanal Details
          </span>
          <h2 className="font-display text-headline-lg font-extrabold tracking-tight text-on-surface">
            Mô tả sản phẩm &amp; Nguồn gốc
          </h2>
          <p className="text-body-md text-on-surface-variant max-w-2xl">
            Từng ly {productName} được chắt lọc từ nguyên liệu Việt Nam chọn lọc và quy trình pha chế thủ công mỗi ngày.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
          {cards.map(({ icon: Icon, iconClass, title, text }) => (
            <div key={title} className="p-space-lg bg-surface rounded-xl shadow-sm flex flex-col gap-space-xs">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${iconClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-display text-headline-sm font-bold text-on-surface">{title}</h3>
              <p className="text-body-sm text-on-surface-variant">{text}</p>
            </div>
          ))}
        </div>

        <div className="p-space-lg bg-surface rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-space-md items-center">
          <div className="flex flex-col gap-1">
            <span className="font-display text-label-md font-bold text-secondary">Cân bằng hương vị</span>
            <h3 className="font-display text-headline-sm font-bold text-on-surface">Chỉ số đánh giá Barista</h3>
            <p className="text-body-sm text-on-surface-variant">
              Thước đo nồng độ và các tầng hương vị trong mỗi ly {productName}.
            </p>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            {flavor.map((item, i) => (
              <div key={item.label}>
                <div className="flex justify-between font-display text-label-sm mb-1 gap-2">
                  <span>{item.label}</span>
                  <span className="text-secondary whitespace-nowrap">{item.score} / 10</span>
                </div>
                <div
                  className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden"
                  role="meter"
                  aria-label={item.label}
                  aria-valuenow={item.score}
                  aria-valuemin={0}
                  aria-valuemax={10}
                >
                  <div className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${item.score * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
