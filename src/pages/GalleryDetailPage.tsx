import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { fetchGalleryDetail, fetchGalleryMetadata } from '@/lib/api'
import { assetUrl } from '@/lib/assets'

interface DetailLocationState {
  from?: string
}

export function GalleryDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const backTarget =
    (location.state as DetailLocationState | null)?.from ?? '/gallery'
  const metadataQuery = useQuery({
    queryKey: ['gallery-metadata'],
    queryFn: fetchGalleryMetadata,
  })
  const detailQuery = useQuery({
    queryKey: ['gallery-detail', id],
    queryFn: () => fetchGalleryDetail(id),
    enabled: Boolean(id),
  })

  const summary = metadataQuery.data?.items.find((item) => item.id === id)

  if (metadataQuery.isPending || detailQuery.isPending) {
    return (
      <section className="detail-page detail-page--loading">
        <div className="detail-image-skeleton" />
        <div className="detail-copy-skeleton" />
      </section>
    )
  }

  if (metadataQuery.isError || detailQuery.isError || !summary) {
    return (
      <section className="state-page">
        <p className="section-kicker">MEMORY NOT FOUND</p>
        <h1>这段记忆不在相册里</h1>
        <p>它可能仍在审核，或已经从旅途相册中移除。</p>
        <Link className="secondary-button" to="/gallery">
          回到旅途相册
        </Link>
      </section>
    )
  }

  const detail = detailQuery.data
  const submitterAvatarUrl = detail.submittedById
    ? `https://avatars.githubusercontent.com/u/${detail.submittedById}?v=4&s=160`
    : `https://github.com/${encodeURIComponent(detail.submittedBy)}.png?size=160`
  const submitterProfileUrl = `https://github.com/${encodeURIComponent(detail.submittedBy)}`

  return (
    <article className="detail-page">
      <div className="detail-page__toolbar">
        <Link className="back-link" to={backTarget}>
          <span aria-hidden="true">←</span>
          回到旅途相册
        </Link>
        <a
          className="download-button"
          href={assetUrl(`images/${summary.fileName}`)}
          download={summary.originalFileName}
        >
          保存这张照片
          <span aria-hidden="true">↓</span>
        </a>
      </div>

      <div className="detail-page__visual">
        <img
          src={assetUrl(`images/${summary.fileName}`)}
          alt={summary.name}
        />
      </div>

      <div className="detail-page__content">
        <div className="detail-page__title">
          <p className="section-kicker">{summary.game.label}</p>
          <h1>{summary.name}</h1>
          <ul className="tag-list tag-list--large" aria-label="标签">
            {summary.tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        </div>

        {detail.description && (
          <div className="detail-page__description">
            <h2>这段记忆的故事</h2>
            {detail.description.split(/\n+/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        )}

        <dl className="detail-facts">
          <div>
            <dt>角色</dt>
            <dd>{summary.character.label}</dd>
          </div>
          <div>
            <dt>创作类型</dt>
            <dd>{summary.creationType.label}</dd>
          </div>
          <div>
            <dt>发布者</dt>
            <dd>{detail.publisher}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>
              <time dateTime={detail.updatedAt}>{detail.updatedAt}</time>
            </dd>
          </div>
          {detail.sourceUrl && (
            <div>
              <dt>图片来源</dt>
              <dd>
                <a href={detail.sourceUrl} target="_blank" rel="noreferrer">
                  查看原始来源 ↗
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt>投稿记录</dt>
            <dd>
              @{detail.submittedBy}
              {detail.issueNumber
                ? ` · Issue #${detail.issueNumber}`
                : ' · 直接收录'}
            </dd>
          </div>
        </dl>

        <div className="submitter-card">
          <img
            src={submitterAvatarUrl}
            alt={`${detail.submittedBy} 的 GitHub 头像`}
            width="72"
            height="72"
            referrerPolicy="no-referrer"
          />
          <div>
            <span>记忆记录者</span>
            <strong>@{detail.submittedBy}</strong>
            <p>
              {detail.issueNumber
                ? `通过 GitHub Issue #${detail.issueNumber} 提交`
                : '由站点维护者直接收录'}
            </p>
          </div>
          <a
            href={submitterProfileUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`查看 ${detail.submittedBy} 的 GitHub 主页`}
          >
            GitHub 主页 ↗
          </a>
        </div>

        <p className="rights-note">
          投稿者已确认该图片符合本站非商业展示与下载要求，并承担相应版权责任。
        </p>
      </div>
    </article>
  )
}
