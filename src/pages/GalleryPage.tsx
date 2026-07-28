import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { GalleryCard } from '@/components/GalleryCard'
import { fetchGalleryMetadata } from '@/lib/api'
import {
  BASE_CHARACTERS,
  CREATION_TYPES,
  GAME,
  PAGE_SIZE,
} from '@/lib/constants'
import {
  filterAndSortGallery,
  parseSort,
  uniqueCategories,
  type GallerySort,
} from '@/lib/gallery'
import type { CategoryRef } from '@/types/gallery'

interface StoredGalleryPosition {
  search: string
  y: number
  visibleCount: number
}

const STORAGE_KEY = 'march7ths:gallery-position'

function mergeCategories(
  base: CategoryRef[],
  dynamic: CategoryRef[],
): CategoryRef[] {
  const result = new Map<string, CategoryRef>()
  base.forEach((item) => result.set(item.id, item))
  dynamic.forEach((item) => result.set(item.id, item))
  return [...result.values()]
}

function readStoredPosition(search: string): StoredGalleryPosition | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as StoredGalleryPosition
    return parsed.search === search ? parsed : null
  } catch {
    return null
  }
}

export function GalleryPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const storedAtStart = useRef(readStoredPosition(location.search))
  const [visibleCount, setVisibleCount] = useState(
    storedAtStart.current?.visibleCount ?? PAGE_SIZE,
  )
  const restoredScroll = useRef(false)
  const metadataQuery = useQuery({
    queryKey: ['gallery-metadata'],
    queryFn: fetchGalleryMetadata,
  })

  const query = searchParams.get('q') ?? ''
  const game = searchParams.get('game') ?? ''
  const character = searchParams.get('character') ?? ''
  const creationType = searchParams.get('type') ?? ''
  const sort = parseSort(searchParams.get('sort'))

  const items = metadataQuery.data?.items ?? []
  const games = mergeCategories(
    [GAME],
    uniqueCategories(items, 'game'),
  )
  const characters = mergeCategories(
    BASE_CHARACTERS,
    uniqueCategories(
      items,
      'character',
      (item) => !game || item.game.id === game,
    ),
  )
  const creationTypes = mergeCategories(
    CREATION_TYPES,
    uniqueCategories(
      items,
      'creationType',
      (item) =>
        (!game || item.game.id === game) &&
        (!character || item.character.id === character),
    ),
  )

  const filteredItems = useMemo(
    () =>
      filterAndSortGallery(items, {
        query,
        game,
        character,
        creationType,
        sort,
      }),
    [items, query, game, character, creationType, sort],
  )

  useEffect(() => {
    if (
      !restoredScroll.current &&
      metadataQuery.isSuccess &&
      storedAtStart.current
    ) {
      restoredScroll.current = true
      requestAnimationFrame(() => {
        window.scrollTo({ top: storedAtStart.current?.y ?? 0 })
      })
    }
  }, [metadataQuery.isSuccess])

  function updateParam(
    key: 'game' | 'character' | 'type' | 'sort',
    value: string,
  ) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'game') {
      next.delete('character')
      next.delete('type')
    }
    if (key === 'character') next.delete('type')
    if (key === 'sort' && value === 'updated-desc') next.delete('sort')
    setSearchParams(next, { replace: true })
    setVisibleCount(PAGE_SIZE)
    restoredScroll.current = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function clearFilters() {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    setSearchParams(next, { replace: true })
    setVisibleCount(PAGE_SIZE)
  }

  function storePosition() {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        search: location.search,
        y: window.scrollY,
        visibleCount,
      } satisfies StoredGalleryPosition),
    )
  }

  if (metadataQuery.isPending) {
    return (
      <section className="gallery-page">
        <GalleryHeading count={null} />
        <div className="gallery-skeleton" aria-label="正在翻开旅途相册">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="skeleton-card" key={index} />
          ))}
        </div>
      </section>
    )
  }

  if (metadataQuery.isError) {
    return (
      <section className="state-page">
        <p className="section-kicker">MEMORY OUT OF RANGE</p>
        <h1>暂时读不到这页相册</h1>
        <p>{metadataQuery.error.message}</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void metadataQuery.refetch()}
        >
          再找一次
        </button>
      </section>
    )
  }

  return (
    <section className="gallery-page">
      <GalleryHeading count={filteredItems.length} />

      <div className="filter-panel" aria-label="旅途相册筛选">
        <label>
          <span>游戏</span>
          <select
            value={game}
            onChange={(event) => updateParam('game', event.target.value)}
          >
            <option value="">全部游戏</option>
            {games.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>角色</span>
          <select
            value={character}
            onChange={(event) => updateParam('character', event.target.value)}
          >
            <option value="">全部角色</option>
            {characters.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>创作类型</span>
          <select
            value={creationType}
            onChange={(event) => updateParam('type', event.target.value)}
          >
            <option value="">全部类型</option>
            {creationTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>排序</span>
          <select
            value={sort}
            onChange={(event) =>
              updateParam('sort', event.target.value as GallerySort)
            }
          >
            <option value="updated-desc">新近记忆优先</option>
            <option value="updated-asc">早期记忆优先</option>
            <option value="relevance" disabled={!query.trim()}>
              相似度
            </option>
          </select>
        </label>
        {(game || character || creationType || sort !== 'updated-desc') && (
          <button
            type="button"
            className="filter-clear"
            onClick={clearFilters}
          >
            清除筛选
          </button>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <div className="gallery-empty">
          <span aria-hidden="true">✦</span>
          <h2>
            {items.length === 0
              ? '相册还没有装入第一段记忆'
              : '这一页没有找到对应的记忆'}
          </h2>
          <p>
            {items.length === 0
              ? '前往投稿，为三月七的旅途留下第一张照片。'
              : '换个角色或标签，也许会与她再次重逢。'}
          </p>
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {filteredItems.slice(0, visibleCount).map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                onOpen={storePosition}
              />
            ))}
          </div>
          {visibleCount < filteredItems.length && (
            <div className="load-more">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
              >
                继续翻阅
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function GalleryHeading({ count }: { count: number | null }) {
  return (
    <header className="page-heading">
      <div>
        <p className="section-kicker">A JOURNEY IN EVERY FRAME</p>
        <h1>旅途相册</h1>
        <p>
          收录《崩坏：星穹铁道》的官方影像与同人创作，让旅途中遇见的每一张面孔与每一处风景，都有迹可循。
        </p>
      </div>
      {count !== null && (
        <p className="result-count">
          <strong>{count}</strong>
          <span>段记忆</span>
        </p>
      )}
    </header>
  )
}
