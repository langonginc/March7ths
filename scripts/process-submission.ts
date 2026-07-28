import { createHash } from 'node:crypto'
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'
import yauzl from 'yauzl'
import { BASE_CHARACTERS, CREATION_TYPES, GAME } from '../src/lib/constants'
import {
  GalleryMetadataSchema,
  SubmissionManifestSchema,
} from '../src/lib/schemas'
import type {
  CategoryRef,
  GalleryItemDetail,
  GalleryItemSummary,
  GalleryMetadata,
  SubmissionItem,
} from '../src/types/gallery'

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024
const MAX_ENTRIES = 25
const MAX_PIXELS = 40_000_000
const ALLOWED_ATTACHMENT_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'user-images.githubusercontent.com',
])

interface ProcessOptions {
  repoRoot: string
  issueNumber: number
  submittedBy: string
  submittedById?: number
  dryRun?: boolean
}

export interface ProcessResult {
  issueNumber: number
  submittedBy: string
  items: Array<{ id: string; name: string; fileName: string }>
}

interface PreparedItem {
  summary: GalleryItemSummary
  detail: GalleryItemDetail
  original: Buffer
  thumbnail: Buffer
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeCharacterLabel(label: string): string {
  return label.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

function safeEntryName(entryName: string): string {
  const normalized = entryName.replaceAll('\\', '/')
  if (
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    normalized.split('/').some((part) => part === '..')
  ) {
    throw new Error(`压缩包包含不安全路径：${entryName}`)
  }
  return normalized
}

async function readZipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  if (buffer.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('投稿 ZIP 超过 25 MB。')
  }

  return new Promise((resolvePromise, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, decodeStrings: true },
      (openError, zip) => {
        if (openError || !zip) {
          reject(new Error(`无法读取投稿 ZIP：${openError?.message ?? '未知错误'}`))
          return
        }

        const entries = new Map<string, Buffer>()
        let entryCount = 0
        let totalBytes = 0
        let settled = false

        const fail = (error: Error) => {
          if (settled) return
          settled = true
          zip.close()
          reject(error)
        }

        zip.on('error', fail)
        zip.on('end', () => {
          if (settled) return
          settled = true
          resolvePromise(entries)
        })
        zip.on('entry', (entry) => {
          try {
            entryCount += 1
            if (entryCount > MAX_ENTRIES) {
              fail(new Error(`压缩包条目不能超过 ${MAX_ENTRIES} 个。`))
              return
            }

            const name = safeEntryName(entry.fileName)
            const mode = (entry.externalFileAttributes >>> 16) & 0xffff
            if ((mode & 0o170000) === 0o120000) {
              fail(new Error(`压缩包不能包含符号链接：${name}`))
              return
            }

            if (name.endsWith('/')) {
              zip.readEntry()
              return
            }

            totalBytes += entry.uncompressedSize
            if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
              fail(new Error('压缩包解压后体积超过 80 MB。'))
              return
            }
            if (entries.has(name)) {
              fail(new Error(`压缩包中存在重复路径：${name}`))
              return
            }

            zip.openReadStream(entry, (streamError, stream) => {
              if (streamError || !stream) {
                fail(
                  new Error(
                    `无法读取压缩包条目 ${name}：${streamError?.message ?? '未知错误'}`,
                  ),
                )
                return
              }
              const chunks: Buffer[] = []
              let bytes = 0
              stream.on('data', (chunk: Buffer) => {
                bytes += chunk.byteLength
                if (bytes > MAX_UNCOMPRESSED_BYTES) {
                  stream.destroy(new Error('压缩包条目过大。'))
                  return
                }
                chunks.push(chunk)
              })
              stream.on('error', fail)
              stream.on('end', () => {
                if (settled) return
                entries.set(name, Buffer.concat(chunks))
                zip.readEntry()
              })
            })
          } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)))
          }
        })

        zip.readEntry()
      },
    )
  })
}

function normalizedImageExtension(
  mime: string,
  manifestPath: string,
): 'jpg' | 'png' | 'webp' {
  const extension = extname(manifestPath).toLowerCase()
  const expectedExtensions: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  }
  const allowed = expectedExtensions[mime]
  if (!allowed || !allowed.includes(extension)) {
    throw new Error(`图片真实格式与扩展名不一致：${manifestPath}`)
  }
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'
}

function resolveCharacter(
  item: SubmissionItem,
  existingItems: GalleryItemSummary[],
): CategoryRef {
  const label = normalizeCharacterLabel(item.character.label)
  const known = BASE_CHARACTERS.find(
    (character) =>
      character.id === item.character.id ||
      normalizeCharacterLabel(character.label).toLocaleLowerCase('zh-CN') ===
        label.toLocaleLowerCase('zh-CN'),
  )
  if (known) return known

  const existing = existingItems
    .map((candidate) => candidate.character)
    .find(
      (character) =>
        normalizeCharacterLabel(character.label).toLocaleLowerCase('zh-CN') ===
        label.toLocaleLowerCase('zh-CN'),
    )
  if (existing) return existing

  if (!item.character.isNew) {
    throw new Error(`未知角色必须标记为新角色：${label}`)
  }

  return {
    id: `custom-${sha256(label).slice(0, 10)}`,
    label,
  }
}

async function prepareItem(
  item: SubmissionItem,
  image: Buffer,
  existingItems: GalleryItemSummary[],
  options: ProcessOptions,
  submittedAt: string,
): Promise<PreparedItem> {
  if (image.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${item.originalFileName} 超过 10 MB。`)
  }

  const detected = await fileTypeFromBuffer(image)
  if (!detected) {
    throw new Error(`无法识别图片格式：${item.originalFileName}`)
  }
  const extension = normalizedImageExtension(detected.mime, item.imagePath)

  const imageMetadata = await sharp(image, {
    failOn: 'error',
    limitInputPixels: MAX_PIXELS,
  }).metadata()
  if (!imageMetadata.width || !imageMetadata.height) {
    throw new Error(`无法读取图片尺寸：${item.originalFileName}`)
  }
  if (imageMetadata.width * imageMetadata.height > MAX_PIXELS) {
    throw new Error(`${item.originalFileName} 超过 4000 万像素。`)
  }

  const hash = sha256(image)
  const id = `img_${hash.slice(0, 16)}`
  if (existingItems.some((existing) => existing.id === id)) {
    throw new Error(`${item.originalFileName} 已存在于画廊中。`)
  }

  const character = resolveCharacter(item, existingItems)
  const creationType =
    CREATION_TYPES.find((type) => type.id === item.creationType.id) ??
    item.creationType
  const fileName = `${id}.${extension}`
  const thumbnail = await sharp(image, {
    failOn: 'error',
    limitInputPixels: MAX_PIXELS,
  })
    .rotate()
    .resize(720, 720, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()

  const summary: GalleryItemSummary = {
    id,
    fileName,
    originalFileName: basename(item.originalFileName),
    name: item.name,
    game: GAME,
    character,
    creationType,
    tags: [...new Set(item.tags)],
    updatedAt: item.updatedAt,
  }

  const detail: GalleryItemDetail = {
    id,
    description: item.description,
    updatedAt: item.updatedAt,
    publisher: item.publisher,
    ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    submittedBy: options.submittedBy,
    ...(options.submittedById
      ? { submittedById: options.submittedById }
      : {}),
    submittedAt,
    issueNumber: options.issueNumber,
    rights: {
      nonCommercialConfirmed: true,
      responsibilityAccepted: true,
    },
  }

  return { summary, detail, original: image, thumbnail }
}

export async function processSubmissionBuffer(
  archive: Buffer,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const entries = await readZipEntries(archive)
  const manifestBuffer = entries.get('submission.json')
  if (!manifestBuffer) throw new Error('压缩包缺少 submission.json。')
  if (manifestBuffer.byteLength > 512 * 1024) {
    throw new Error('submission.json 不能超过 512 KB。')
  }

  let rawManifest: unknown
  try {
    rawManifest = JSON.parse(manifestBuffer.toString('utf8'))
  } catch {
    throw new Error('submission.json 不是有效的 JSON。')
  }
  const manifest = SubmissionManifestSchema.parse(rawManifest)

  const expectedPaths = new Set([
    'submission.json',
    ...manifest.items.map((item) => item.imagePath),
  ])
  const unexpected = [...entries.keys()].filter(
    (entryName) => !expectedPaths.has(entryName),
  )
  if (unexpected.length > 0) {
    throw new Error(`压缩包包含未声明文件：${unexpected.join('、')}`)
  }
  const missing = [...expectedPaths].filter((entryName) => !entries.has(entryName))
  if (missing.length > 0) {
    throw new Error(`压缩包缺少文件：${missing.join('、')}`)
  }

  const metadataPath = resolve(options.repoRoot, 'public/metadata.json')
  const existingMetadata = GalleryMetadataSchema.parse(
    JSON.parse(await readFile(metadataPath, 'utf8')),
  ) as GalleryMetadata
  const submittedAt = new Date().toISOString()
  const preparedItems: PreparedItem[] = []
  const submissionIds = new Set<string>()

  for (const item of manifest.items) {
    const image = entries.get(item.imagePath)
    if (!image) throw new Error(`找不到图片：${item.imagePath}`)
    const prepared = await prepareItem(
      item,
      image,
      existingMetadata.items,
      options,
      submittedAt,
    )
    if (submissionIds.has(prepared.summary.id)) {
      throw new Error(`投稿包中包含重复图片：${item.originalFileName}`)
    }
    submissionIds.add(prepared.summary.id)
    preparedItems.push(prepared)
  }

  const nextMetadata: GalleryMetadata = {
    schemaVersion: 1,
    items: [...existingMetadata.items, ...preparedItems.map((item) => item.summary)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  }

  if (!options.dryRun) {
    await Promise.all([
      mkdir(resolve(options.repoRoot, 'public/images'), { recursive: true }),
      mkdir(resolve(options.repoRoot, 'public/thumbnails'), { recursive: true }),
      mkdir(resolve(options.repoRoot, 'public/metadata'), { recursive: true }),
    ])

    await Promise.all(
      preparedItems.flatMap((item) => [
        writeFile(
          resolve(options.repoRoot, 'public/images', item.summary.fileName),
          item.original,
        ),
        writeFile(
          resolve(options.repoRoot, 'public/thumbnails', `${item.summary.id}.jpg`),
          item.thumbnail,
        ),
        writeFile(
          resolve(options.repoRoot, 'public/metadata', `${item.summary.id}.json`),
          `${JSON.stringify(item.detail, null, 2)}\n`,
        ),
      ]),
    )
    await writeFile(metadataPath, `${JSON.stringify(nextMetadata, null, 2)}\n`)
  }

  return {
    issueNumber: options.issueNumber,
    submittedBy: options.submittedBy,
    items: preparedItems.map((item) => ({
      id: item.summary.id,
      name: item.summary.name,
      fileName: item.summary.fileName,
    })),
  }
}

function validateAttachmentUrl(value: string): URL {
  const url = new URL(value)
  const isGitHubAssetBucket =
    /^github-production-user-asset-[a-z0-9-]+\.s3\.amazonaws\.com$/.test(
      url.hostname,
    )
  if (
    url.protocol !== 'https:' ||
    (!ALLOWED_ATTACHMENT_HOSTS.has(url.hostname) && !isGitHubAssetBucket) ||
    (url.hostname === 'github.com' && !url.pathname.includes('/user-attachments/'))
  ) {
    throw new Error('Issue 中的附件地址不受信任。')
  }
  return url
}

function extractAttachmentUrl(event: Record<string, unknown>): URL {
  const issue = event.issue as
    | { body?: string | null; number?: number; user?: { login?: string } }
    | undefined
  const body = issue?.body ?? ''
  const candidates = body.match(/https:\/\/[^\s)\]>"']+/g) ?? []
  for (const candidate of candidates) {
    try {
      const url = validateAttachmentUrl(candidate.replace(/[.,;]+$/, ''))
      if (
        url.pathname.includes('/user-attachments/') ||
        /\.(?:zip)(?:$|\?)/i.test(url.pathname)
      ) {
        return url
      }
    } catch {
      // Continue until a valid GitHub attachment is found.
    }
  }
  throw new Error('Issue 中没有找到有效的 ZIP 附件。')
}

async function downloadAttachment(startUrl: URL): Promise<Buffer> {
  let url = startUrl
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : undefined,
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('附件重定向缺少目标地址。')
      url = validateAttachmentUrl(new URL(location, url).toString())
      continue
    }
    if (!response.ok) {
      throw new Error(`附件下载失败（HTTP ${response.status}）。`)
    }
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_ARCHIVE_BYTES) {
      throw new Error('投稿 ZIP 超过 25 MB。')
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('附件响应没有可读取内容。')
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_ARCHIVE_BYTES) {
        await reader.cancel()
        throw new Error('投稿 ZIP 超过 25 MB。')
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  }
  throw new Error('附件重定向次数过多。')
}

function markdownEscape(value: string): string {
  return value.replace(/[\\`*_[\]<>]/g, '\\$&')
}

async function writeBotMessages(
  root: string,
  result: ProcessResult | null,
  error: Error | null,
) {
  const botDirectory = resolve(root, '.bot')
  await mkdir(botDirectory, { recursive: true })
  if (result) {
    const itemList = result.items
      .map((item) => `- **${markdownEscape(item.name)}**（\`${item.id}\`）`)
      .join('\n')
    await Promise.all([
      writeFile(
        resolve(botDirectory, 'success.md'),
        `投稿包已通过自动校验，并已生成收录 PR。\n\n${itemList}\n`,
      ),
      writeFile(
        resolve(botDirectory, 'pr-body.md'),
        `本 PR 由 March7ths issue_bot 根据投稿 Issue #${result.issueNumber} 自动生成。\n\n${itemList}\n\nCloses #${result.issueNumber}\n`,
      ),
      writeFile(
        resolve(botDirectory, 'result.json'),
        `${JSON.stringify(result, null, 2)}\n`,
      ),
    ])
  }
  if (error) {
    await writeFile(
      resolve(botDirectory, 'error.md'),
      `投稿包未通过自动校验。\n\n> ${markdownEscape(error.message)}\n\n请修正后重新创建投稿 Issue。\n`,
    )
  }
}

async function runCli() {
  const args = new Map<string, string>()
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (key?.startsWith('--') && value) args.set(key.slice(2), value)
  }

  const repoRoot = resolve(args.get('root') ?? process.cwd())
  let archive: Buffer
  let issueNumber = Number(process.env.ISSUE_NUMBER ?? args.get('issue') ?? 0)
  let submittedBy = process.env.ISSUE_AUTHOR ?? args.get('author') ?? 'local'
  let submittedById = Number(process.env.ISSUE_AUTHOR_ID ?? 0) || undefined

  if (args.has('event')) {
    const event = JSON.parse(
      await readFile(resolve(args.get('event')!), 'utf8'),
    ) as Record<string, unknown>
    const issue = event.issue as
      | { number?: number; user?: { login?: string; id?: number } }
      | undefined
    issueNumber ||= issue?.number ?? 0
    submittedBy =
      process.env.ISSUE_AUTHOR ?? issue?.user?.login ?? submittedBy
    submittedById = submittedById ?? issue?.user?.id
    archive = await downloadAttachment(extractAttachmentUrl(event))
  } else if (args.has('zip')) {
    archive = await readFile(resolve(args.get('zip')!))
  } else {
    throw new Error('需要提供 --event <event.json> 或 --zip <submission.zip>。')
  }

  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error('缺少有效的 Issue 编号。')
  }

  try {
    const result = await processSubmissionBuffer(archive, {
      repoRoot,
      issueNumber,
      submittedBy,
      submittedById,
      dryRun: args.get('dry-run') === 'true',
    })
    await writeBotMessages(repoRoot, result, null)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    const normalized =
      error instanceof Error ? error : new Error(String(error))
    await writeBotMessages(repoRoot, null, normalized)
    throw normalized
  }
}

const entryPoint = process.argv[1]
if (
  entryPoint &&
  import.meta.url === pathToFileURL(resolve(entryPoint)).href
) {
  runCli().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  })
}
