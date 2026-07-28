import Fuse from 'fuse.js'
import type { CategoryRef, GalleryItemSummary } from '@/types/gallery'

export type GallerySort = 'updated-desc' | 'updated-asc' | 'relevance'

export interface GalleryFilters {
  query: string
  game: string
  character: string
  creationType: string
  sort: GallerySort
}

const FUSE_OPTIONS = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.42,
  keys: [
    { name: 'name', weight: 5 },
    { name: 'tags', weight: 4 },
    { name: 'character.label', weight: 3 },
    { name: 'creationType.label', weight: 2 },
    { name: 'game.label', weight: 1 },
  ],
}

export function filterAndSortGallery(
  items: GalleryItemSummary[],
  filters: GalleryFilters,
): GalleryItemSummary[] {
  const categoryFiltered = items.filter(
    (item) =>
      (!filters.game || item.game.id === filters.game) &&
      (!filters.character || item.character.id === filters.character) &&
      (!filters.creationType ||
        item.creationType.id === filters.creationType),
  )

  const query = filters.query.trim()
  const result =
    query.length > 0
      ? new Fuse(categoryFiltered, FUSE_OPTIONS)
          .search(query)
          .map((match) => ({ item: match.item, score: match.score ?? 1 }))
      : categoryFiltered.map((item) => ({ item, score: 1 }))

  const sort =
    filters.sort === 'relevance' && query.length === 0
      ? 'updated-desc'
      : filters.sort

  result.sort((a, b) => {
    if (sort === 'relevance') return a.score - b.score
    const comparison = a.item.updatedAt.localeCompare(b.item.updatedAt)
    return sort === 'updated-asc' ? comparison : -comparison
  })

  return result.map(({ item }) => item)
}

export function uniqueCategories(
  items: GalleryItemSummary[],
  key: 'game' | 'character' | 'creationType',
  predicate: (item: GalleryItemSummary) => boolean = () => true,
): CategoryRef[] {
  const categories = new Map<string, CategoryRef>()
  items.filter(predicate).forEach((item) => {
    const category = item[key]
    categories.set(category.id, category)
  })
  return [...categories.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'zh-CN'),
  )
}

export function parseSort(value: string | null): GallerySort {
  if (
    value === 'updated-asc' ||
    value === 'updated-desc' ||
    value === 'relevance'
  ) {
    return value
  }
  return 'updated-desc'
}
