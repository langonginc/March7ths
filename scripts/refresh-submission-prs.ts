import { execFileSync } from 'node:child_process'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { GalleryMetadataSchema } from '../src/lib/schemas'
import type {
  GalleryItemDetail,
  GalleryItemSummary,
  GalleryMetadata,
} from '../src/types/gallery'

interface PullRequest {
  number: number
  headRefName: string
}

interface SubmissionSnapshot {
  summary: GalleryItemSummary
  detail: GalleryItemDetail
  imagePath: string
  thumbnailPath: string
}

function git(args: string[], options: { capture?: boolean } = {}): string {
  if (!options.capture) {
    execFileSync('git', args, { stdio: 'inherit' })
    return ''
  }
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

async function readSubmissionSnapshots(
  repoRoot: string,
  issueNumber: number,
): Promise<SubmissionSnapshot[]> {
  const metadata = GalleryMetadataSchema.parse(
    JSON.parse(
      await readFile(resolve(repoRoot, 'public/metadata.json'), 'utf8'),
    ),
  ) as GalleryMetadata
  const snapshots: SubmissionSnapshot[] = []

  for (const summary of metadata.items) {
    const detailPath = resolve(
      repoRoot,
      'public/metadata',
      `${summary.id}.json`,
    )
    try {
      const detail = JSON.parse(
        await readFile(detailPath, 'utf8'),
      ) as GalleryItemDetail
      if (detail.issueNumber === issueNumber) {
        snapshots.push({
          summary,
          detail,
          imagePath: resolve(repoRoot, 'public/images', summary.fileName),
          thumbnailPath: resolve(
            repoRoot,
            'public/thumbnails',
            `${summary.id}.jpg`,
          ),
        })
      }
    } catch {
      // Ignore details unrelated to this generated submission.
    }
  }
  return snapshots
}

async function refreshPullRequest(pr: PullRequest, repoRoot: string) {
  if (!/^bot\/submission-\d+$/.test(pr.headRefName)) return
  const issueNumber = Number(pr.headRefName.split('-').pop())
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) return

  git([
    'fetch',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    `+refs/heads/${pr.headRefName}:refs/remotes/origin/${pr.headRefName}`,
  ])
  git(['checkout', '-B', pr.headRefName, `origin/${pr.headRefName}`])
  const oldHead = git(['rev-parse', 'HEAD'], { capture: true })
  const snapshots = await readSubmissionSnapshots(repoRoot, issueNumber)
  if (snapshots.length === 0) return

  const snapshotRoot = await mkdtemp(
    resolve(tmpdir(), `march7ths-submission-${issueNumber}-`),
  )
  try {
    for (const snapshot of snapshots) {
      await mkdir(resolve(snapshotRoot, 'images'), { recursive: true })
      await mkdir(resolve(snapshotRoot, 'thumbnails'), { recursive: true })
      await cp(
        snapshot.imagePath,
        resolve(snapshotRoot, 'images', basename(snapshot.imagePath)),
      )
      await cp(
        snapshot.thumbnailPath,
        resolve(
          snapshotRoot,
          'thumbnails',
          basename(snapshot.thumbnailPath),
        ),
      )
    }

    git(['reset', '--hard', 'origin/main'])
    const baseMetadata = GalleryMetadataSchema.parse(
      JSON.parse(
        await readFile(resolve(repoRoot, 'public/metadata.json'), 'utf8'),
      ),
    ) as GalleryMetadata
    const existingIds = new Set(baseMetadata.items.map((item) => item.id))
    const retained = snapshots.filter(
      (snapshot) => !existingIds.has(snapshot.summary.id),
    )

    for (const snapshot of retained) {
      await mkdir(resolve(repoRoot, 'public/images'), { recursive: true })
      await mkdir(resolve(repoRoot, 'public/thumbnails'), { recursive: true })
      await mkdir(resolve(repoRoot, 'public/metadata'), { recursive: true })
      await cp(
        resolve(snapshotRoot, 'images', basename(snapshot.imagePath)),
        snapshot.imagePath,
      )
      await cp(
        resolve(snapshotRoot, 'thumbnails', basename(snapshot.thumbnailPath)),
        snapshot.thumbnailPath,
      )
      await writeFile(
        resolve(repoRoot, 'public/metadata', `${snapshot.summary.id}.json`),
        `${JSON.stringify(snapshot.detail, null, 2)}\n`,
      )
    }

    const nextMetadata: GalleryMetadata = {
      schemaVersion: 1,
      items: [
        ...baseMetadata.items,
        ...retained.map((snapshot) => snapshot.summary),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }
    await writeFile(
      resolve(repoRoot, 'public/metadata.json'),
      `${JSON.stringify(nextMetadata, null, 2)}\n`,
    )

    git([
      'add',
      'public/metadata.json',
      'public/metadata',
      'public/images',
      'public/thumbnails',
    ])
    let hasChanges = false
    try {
      execFileSync('git', ['diff', '--cached', '--quiet'], {
        stdio: 'ignore',
      })
    } catch {
      hasChanges = true
    }
    if (!hasChanges) {
      return
    }
    git(['commit', '-m', `chore: refresh submission #${issueNumber}`])
    git([
      'push',
      `--force-with-lease=refs/heads/${pr.headRefName}:${oldHead}`,
      'origin',
      `HEAD:refs/heads/${pr.headRefName}`,
    ])
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true })
  }
}

async function main() {
  const repoRoot = process.cwd()
  git(['config', 'user.name', 'github-actions[bot]'])
  git([
    'config',
    'user.email',
    '41898282+github-actions[bot]@users.noreply.github.com',
  ])
  git([
    'fetch',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
  ])

  const pullRequests = JSON.parse(
    execFileSync(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'open',
        '--label',
        'image-submission',
        '--json',
        'number,headRefName',
        '--limit',
        '100',
      ],
      { encoding: 'utf8' },
    ),
  ) as PullRequest[]

  for (const pullRequest of pullRequests) {
    await refreshPullRequest(pullRequest, repoRoot)
  }
  git(['checkout', '-B', 'main', 'origin/main'])
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  )
  process.exitCode = 1
})
