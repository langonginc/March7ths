import { z } from 'zod'

const CategoryRefSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
})

const OptionalHttpsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => {
      if (!value) return true
      try {
        return new URL(value).protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: '来源链接必须使用有效的 HTTPS 地址' },
  )
  .optional()

export const GalleryItemSummarySchema = z.object({
  id: z.string().regex(/^img_[a-f0-9]{16}$/),
  fileName: z.string().trim().min(1).max(140),
  originalFileName: z.string().trim().min(1).max(140),
  name: z.string().trim().min(1).max(80),
  game: CategoryRefSchema,
  character: CategoryRefSchema,
  creationType: CategoryRefSchema,
  tags: z.array(z.string().trim().min(1).max(24)).max(12),
  updatedAt: z.iso.date(),
})

export const GalleryMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(GalleryItemSummarySchema),
})

export const GalleryItemDetailSchema = z.object({
  id: z.string().regex(/^img_[a-f0-9]{16}$/),
  description: z.string().trim().max(2000),
  updatedAt: z.iso.date(),
  publisher: z.string().trim().min(1).max(100),
  sourceUrl: OptionalHttpsUrlSchema,
  submittedBy: z.string().trim().min(1).max(100),
  submittedById: z.number().int().positive().optional(),
  submittedAt: z.iso.datetime(),
  issueNumber: z.number().int().positive().optional(),
  rights: z.object({
    nonCommercialConfirmed: z.literal(true),
    responsibilityAccepted: z.literal(true),
  }),
})

export const SubmissionItemSchema = z.object({
  clientId: z.string().trim().min(1).max(80),
  imagePath: z
    .string()
    .regex(/^images\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i),
  originalFileName: z.string().trim().min(1).max(140),
  name: z.string().trim().min(1).max(80),
  game: CategoryRefSchema.refine((value) => value.id === 'honkai-star-rail', {
    message: '暂仅支持崩坏星穹铁道',
  }),
  character: CategoryRefSchema.extend({ isNew: z.boolean().optional() }),
  creationType: CategoryRefSchema.refine(
    (value) =>
      ['official-game-pv', 'official-portrait', 'fan-art'].includes(value.id),
    { message: '不支持的创作类型' },
  ),
  tags: z.array(z.string().trim().min(1).max(24)).max(12),
  description: z.string().trim().max(2000),
  updatedAt: z.iso.date(),
  publisher: z.string().trim().min(1).max(100),
  sourceUrl: OptionalHttpsUrlSchema,
  rights: z.object({
    nonCommercialConfirmed: z.literal(true),
    responsibilityAccepted: z.literal(true),
  }),
})

export const SubmissionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  items: z.array(SubmissionItemSchema).min(1).max(20),
})
