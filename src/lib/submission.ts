import JSZip from 'jszip'
import { MAX_PACKAGE_BYTES } from '@/lib/constants'
import { SubmissionManifestSchema } from '@/lib/schemas'
import type { SubmissionItem, SubmissionManifest } from '@/types/gallery'

export interface SubmissionSource {
  file: File
  manifest: SubmissionItem
}

function extensionOf(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (!extension) throw new Error(`无法识别文件扩展名：${fileName}`)
  return extension === 'jpeg' ? 'jpg' : extension
}

export function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
}

export async function buildSubmissionPackage(
  sources: SubmissionSource[],
): Promise<{ blob: Blob; fileName: string; manifest: SubmissionManifest }> {
  const generatedAt = new Date().toISOString()
  const manifest: SubmissionManifest = {
    schemaVersion: 1,
    generatedAt,
    items: sources.map(({ file, manifest: item }) => ({
      ...item,
      imagePath: `images/${item.clientId}.${extensionOf(file.name)}`,
    })),
  }

  SubmissionManifestSchema.parse(manifest)

  const zip = new JSZip()
  zip.file('submission.json', JSON.stringify(manifest, null, 2))
  sources.forEach(({ file, manifest: item }) => {
    const imagePath = manifest.items.find(
      (candidate) => candidate.clientId === item.clientId,
    )?.imagePath
    if (!imagePath) throw new Error('投稿文件映射失败')
    zip.file(imagePath, file)
  })

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  if (blob.size > MAX_PACKAGE_BYTES) {
    throw new Error('整合文件超过 24 MB，请减少图片数量或压缩原图后重试。')
  }

  const stamp = generatedAt.replace(/[:.]/g, '-')
  return {
    blob,
    manifest,
    fileName: `march7ths-submission-${stamp}.zip`,
  }
}
