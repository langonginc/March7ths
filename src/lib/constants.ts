import type { CategoryRef } from '@/types/gallery'

export const GAME: CategoryRef = {
  id: 'honkai-star-rail',
  label: '崩坏：星穹铁道',
}

export const BASE_CHARACTERS: CategoryRef[] = [
  { id: 'march-7th', label: '三月七' },
  { id: 'evernight', label: '长夜月' },
]

export const CREATION_TYPES: CategoryRef[] = [
  { id: 'official-game-pv', label: '游戏画面与 PV' },
  { id: 'official-portrait', label: '官方立绘' },
  { id: 'fan-art', label: '同人创作' },
]

export const ISSUE_FORM_URL =
  'https://github.com/langonginc/March7ths/issues/new?template=image-submission.yml'

export const MAX_IMAGES = 20
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_PACKAGE_BYTES = 24 * 1024 * 1024
export const PAGE_SIZE = 24
