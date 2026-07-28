// @vitest-environment node

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import JSZip from 'jszip'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { processSubmissionBuffer } from './process-submission'

const roots: string[] = []

async function createRepoRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'march7ths-bot-test-'))
  roots.push(root)
  await mkdir(resolve(root, 'public'), { recursive: true })
  await writeFile(
    resolve(root, 'public/metadata.json'),
    JSON.stringify({ schemaVersion: 1, items: [] }),
  )
  return root
}

async function createSubmissionZip(path = 'images/client-1.png') {
  const image = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 230, g: 170, b: 220, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
  const zip = new JSZip()
  zip.file(
    'submission.json',
    JSON.stringify({
      schemaVersion: 1,
      generatedAt: '2026-07-28T00:00:00.000Z',
      items: [
        {
          clientId: 'client-1',
          imagePath: path,
          originalFileName: 'memory.png',
          name: '三月七的星光',
          game: { id: 'honkai-star-rail', label: '崩坏星穹铁道' },
          character: { id: 'march-7th', label: '三月七' },
          creationType: { id: 'official-portrait', label: '立绘' },
          tags: ['星光'],
          description: '一幅用于自动化测试的星光记忆。',
          updatedAt: '2026-07-28',
          publisher: 'test publisher',
          sourceUrl: 'https://example.com/source',
          rights: {
            nonCommercialConfirmed: true,
            responsibilityAccepted: true,
          },
        },
      ],
    }),
  )
  zip.file(path, image)
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

describe('issue bot submission processor', () => {
  it('creates original, thumbnail, detail, and summary metadata', async () => {
    const root = await createRepoRoot()
    const result = await processSubmissionBuffer(
      await createSubmissionZip(),
      {
        repoRoot: root,
        issueNumber: 42,
        submittedBy: 'octocat',
        submittedById: 583231,
      },
    )

    expect(result.items).toHaveLength(1)
    const id = result.items[0].id
    const metadata = JSON.parse(
      await readFile(resolve(root, 'public/metadata.json'), 'utf8'),
    )
    const detail = JSON.parse(
      await readFile(resolve(root, `public/metadata/${id}.json`), 'utf8'),
    )
    expect(metadata.items[0].id).toBe(id)
    expect(detail.issueNumber).toBe(42)
    expect(detail.submittedById).toBe(583231)
    expect(
      await readFile(resolve(root, `public/thumbnails/${id}.jpg`)),
    ).not.toHaveLength(0)
  })

  it('rejects a mismatched image extension', async () => {
    const root = await createRepoRoot()
    await expect(
      processSubmissionBuffer(
        await createSubmissionZip('images/client-1.jpg'),
        {
          repoRoot: root,
          issueNumber: 43,
          submittedBy: 'octocat',
        },
      ),
    ).rejects.toThrow('真实格式与扩展名不一致')
  })

  it('accepts a submission without a source URL', async () => {
    const root = await createRepoRoot()
    const archive = await createSubmissionZip()
    const zip = await JSZip.loadAsync(archive)
    const manifest = JSON.parse(
      await zip.file('submission.json')!.async('string'),
    )
    delete manifest.items[0].sourceUrl
    zip.file('submission.json', JSON.stringify(manifest))

    await expect(
      processSubmissionBuffer(
        Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
        {
          repoRoot: root,
          issueNumber: 44,
          submittedBy: 'octocat',
        },
      ),
    ).resolves.toMatchObject({ issueNumber: 44 })
  })

  it('accepts a submission without a description', async () => {
    const root = await createRepoRoot()
    const archive = await createSubmissionZip()
    const zip = await JSZip.loadAsync(archive)
    const manifest = JSON.parse(
      await zip.file('submission.json')!.async('string'),
    )
    manifest.items[0].description = ''
    zip.file('submission.json', JSON.stringify(manifest))

    const result = await processSubmissionBuffer(
      Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
      {
        repoRoot: root,
        issueNumber: 45,
        submittedBy: 'octocat',
      },
    )
    const detail = JSON.parse(
      await readFile(
        resolve(root, `public/metadata/${result.items[0].id}.json`),
        'utf8',
      ),
    )
    expect(detail.description).toBe('')
  })
})
