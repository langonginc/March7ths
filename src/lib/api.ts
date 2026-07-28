import { GalleryItemDetailSchema, GalleryMetadataSchema } from '@/lib/schemas'
import { versionedAssetUrl } from '@/lib/assets'
import type { GalleryItemDetail, GalleryMetadata } from '@/types/gallery'

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? '没有找到请求的内容'
        : `数据读取失败（${response.status}）`,
    )
  }

  return response.json()
}

export async function fetchGalleryMetadata(): Promise<GalleryMetadata> {
  return GalleryMetadataSchema.parse(
    await fetchJson(versionedAssetUrl('metadata.json')),
  )
}

export async function fetchGalleryDetail(
  id: string,
): Promise<GalleryItemDetail> {
  return GalleryItemDetailSchema.parse(
    await fetchJson(versionedAssetUrl(`metadata/${encodeURIComponent(id)}.json`)),
  )
}
