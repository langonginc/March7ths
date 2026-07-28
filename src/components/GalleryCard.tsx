import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { fetchGalleryDetail } from '@/lib/api'
import { assetUrl } from '@/lib/assets'
import type { GalleryItemSummary } from '@/types/gallery'

interface GalleryCardProps {
  item: GalleryItemSummary
  onOpen: () => void
}

export function GalleryCard({ item, onOpen }: GalleryCardProps) {
  const queryClient = useQueryClient()
  const location = useLocation()

  function prefetchDetail() {
    void queryClient.prefetchQuery({
      queryKey: ['gallery-detail', item.id],
      queryFn: () => fetchGalleryDetail(item.id),
    })
  }

  return (
    <article className="gallery-card">
      <Link
        to={`/gallery/${item.id}`}
        state={{ from: `${location.pathname}${location.search}` }}
        className="gallery-card__link"
        onClick={onOpen}
        onMouseEnter={prefetchDetail}
        onFocus={prefetchDetail}
        onTouchStart={prefetchDetail}
      >
        <div className="gallery-card__image-wrap">
          <img
            src={assetUrl(`thumbnails/${item.id}.jpg`)}
            alt={item.name}
            loading="lazy"
            decoding="async"
          />
          <span className="gallery-card__type">
            {item.creationType.label}
          </span>
        </div>
        <div className="gallery-card__body">
          <h2>{item.name}</h2>
          <p>
            {item.character.label}
            <span aria-hidden="true"> · </span>
            <time dateTime={item.updatedAt}>{item.updatedAt}</time>
          </p>
          {item.tags.length > 0 && (
            <ul className="tag-list" aria-label="标签">
              {item.tags.slice(0, 3).map((tag) => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </article>
  )
}
