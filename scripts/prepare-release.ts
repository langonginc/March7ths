import { execFileSync } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const bump = process.argv[2]
if (!['patch', 'minor', 'major'].includes(bump)) {
  throw new Error('版本类型必须是 patch、minor 或 major。')
}

const runId = process.env.GITHUB_RUN_ID
if (!runId) throw new Error('缺少 GITHUB_RUN_ID。')

const marker = `release-run:${runId}`
const existingCommit = execFileSync(
  'git',
  ['log', '--all', '--fixed-strings', '--grep', marker, '--format=%H', '-n', '1'],
  { encoding: 'utf8' },
).trim()

let reused = false
if (existingCommit) {
  reused = true
} else {
  execFileSync('npm', ['version', bump, '--no-git-tag-version'], {
    stdio: 'inherit',
  })
}

const packageJson = JSON.parse(
  await readFile(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { version: string }

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `version=${packageJson.version}\nreused=${String(reused)}\nmarker=${marker}\n`,
  )
}

process.stdout.write(
  `release v${packageJson.version}${reused ? '（复用当前 workflow run）' : ''}\n`,
)
