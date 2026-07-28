import { describe, expect, it } from 'vitest'
import { filterAndSortGallery, uniqueCategories } from '@/lib/gallery'
import type { GalleryItemSummary } from '@/types/gallery'

const items: GalleryItemSummary[] = [
  {
    id: 'img_aaaaaaaaaaaaaaaa',
    fileName: 'img_aaaaaaaaaaaaaaaa.jpg',
    originalFileName: 'march.jpg',
    name: '三月七的星光',
    game: { id: 'honkai-star-rail', label: '崩坏星穹铁道' },
    character: { id: 'march-7th', label: '三月七' },
    creationType: { id: 'official-portrait', label: '立绘' },
    tags: ['星光', '列车'],
    updatedAt: '2026-02-01',
  },
  {
    id: 'img_bbbbbbbbbbbbbbbb',
    fileName: 'img_bbbbbbbbbbbbbbbb.webp',
    originalFileName: 'evernight.webp',
    name: '长夜月',
    game: { id: 'honkai-star-rail', label: '崩坏星穹铁道' },
    character: { id: 'evernight', label: '长夜月' },
    creationType: { id: 'fan-art', label: '二创' },
    tags: ['月夜'],
    updatedAt: '2026-03-01',
  },
]

describe('filterAndSortGallery', () => {
  it('defaults to newest first', () => {
    const result = filterAndSortGallery(items, {
      query: '',
      game: '',
      character: '',
      creationType: '',
      sort: 'updated-desc',
    })
    expect(result.map((item) => item.id)).toEqual([
      'img_bbbbbbbbbbbbbbbb',
      'img_aaaaaaaaaaaaaaaa',
    ])
  })

  it('filters through the category hierarchy', () => {
    const result = filterAndSortGallery(items, {
      query: '',
      game: 'honkai-star-rail',
      character: 'march-7th',
      creationType: 'official-portrait',
      sort: 'updated-desc',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('三月七的星光')
  })

  it('uses weighted text relevance', () => {
    const result = filterAndSortGallery(items, {
      query: '三月七',
      game: '',
      character: '',
      creationType: '',
      sort: 'relevance',
    })
    expect(result[0].character.id).toBe('march-7th')
  })
})

describe('uniqueCategories', () => {
  it('deduplicates category references', () => {
    expect(uniqueCategories(items, 'game')).toEqual([
      { id: 'honkai-star-rail', label: '崩坏星穹铁道' },
    ])
  })
})
