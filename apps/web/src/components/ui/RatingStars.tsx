import { Star, StarHalf } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  className?: string;
}

/** 5 ngôi sao, làm tròn xuống nửa sao gần nhất (4.8 → 4 sao rưỡi). */
export const RatingStars: React.FC<RatingStarsProps> = ({ rating, className = 'w-[18px] h-[18px]' }) => {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <span className="flex items-center text-[#d97706]" aria-label={`${rating} trên 5 sao`} role="img">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) return <Star key={i} className={className} fill="currentColor" />;
        if (i === full && hasHalf) return <StarHalf key={i} className={className} fill="currentColor" />;
        return <Star key={i} className={`${className} opacity-30`} />;
      })}
    </span>
  );
};
