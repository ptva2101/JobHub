import type { ReviewRating } from '../../types/review'

interface StarRatingProps {
  value: number
  onChange?: (rating: ReviewRating) => void
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

const ratings: ReviewRating[] = [1, 2, 3, 4, 5]
const sizeClasses = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-3xl',
}

export function StarRating({
  value,
  onChange,
  label = `${value} trên 5 sao`,
  size = 'md',
}: StarRatingProps) {
  if (!onChange) {
    return (
      <span aria-label={label} className={`inline-flex gap-0.5 ${sizeClasses[size]}`} role="img">
        {ratings.map((rating) => (
          <span className={rating <= Math.round(value) ? 'text-amber-400' : 'text-slate-200'} key={rating}>★</span>
        ))}
      </span>
    )
  }

  return (
    <div aria-label={label} className="flex w-fit gap-1" role="radiogroup">
      {ratings.map((rating) => (
        <button
          aria-checked={rating === value}
          aria-label={`${rating} sao`}
          className={`${sizeClasses[size]} leading-none transition hover:scale-110 ${rating <= value ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
          key={rating}
          onClick={() => onChange(rating)}
          role="radio"
          type="button"
        >
          ★
        </button>
      ))}
    </div>
  )
}
