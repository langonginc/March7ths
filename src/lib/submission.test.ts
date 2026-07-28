import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { CREATION_TYPES, GAME } from '@/lib/constants'
import { buildSubmissionPackage, parseTags } from '@/lib/submission'

describe('submission package', () => {
  it('normalizes comma-separated tags', () => {
    expect(parseTags('星光, 三月七，星光')).toEqual(['星光', '三月七'])
  })

  it('contains the manifest and original image', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'memory.jpg', {
      type: 'image/jpeg',
    })
    const result = await buildSubmissionPackage([
      {
        file,
        manifest: {
          clientId: 'client-1',
          imagePath: 'images/client-1.jpg',
          originalFileName: file.name,
          name: '星光记忆',
          game: GAME,
          character: { id: 'march-7th', label: '三月七' },
          creationType: CREATION_TYPES[0],
          tags: ['星光'],
          description: '一段值得珍藏的星光记忆。',
          updatedAt: '2026-07-28',
          publisher: 'tester',
          rights: {
            nonCommercialConfirmed: true,
            responsibilityAccepted: true,
          },
        },
      },
    ])

    const zip = await JSZip.loadAsync(result.blob)
    expect(Object.keys(zip.files).sort()).toEqual([
      'images/',
      'images/client-1.jpg',
      'submission.json',
    ])
    const manifest = JSON.parse(
      await zip.file('submission.json')!.async('string'),
    )
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.items[0].imagePath).toBe('images/client-1.jpg')
  })
})
