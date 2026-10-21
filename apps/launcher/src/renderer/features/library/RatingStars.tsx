import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The user's 1–5 rating (FR-LIB-7); choosing the current value again clears it. */
export function RatingStars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t('library.details.rating')} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={t('library.details.rate', { count: stars })}
          onClick={() => {
            onChange(value === stars ? null : stars);
          }}
          className="rounded p-0.5 hover:bg-white/10"
        >
          <Star
            aria-hidden="true"
            className={`h-4 w-4 ${
              value !== null && stars <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
