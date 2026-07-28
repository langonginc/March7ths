export interface CategoryRef {
  id: string
  label: string
}

export interface GalleryItemSummary {
  id: string
  fileName: string
  originalFileName: string
  name: string
  game: CategoryRef
  character: CategoryRef
  creationType: CategoryRef
  tags: string[]
  updatedAt: string
}

export interface GalleryMetadata {
  schemaVersion: 1
  items: GalleryItemSummary[]
}

export interface RightsConfirmation {
  nonCommercialConfirmed: true
  responsibilityAccepted: true
}

export interface GalleryItemDetail {
  id: string
  description: string
  updatedAt: string
  publisher: string
  sourceUrl?: string
  submittedBy: string
  submittedById?: number
  submittedAt: string
  issueNumber?: number
  rights: RightsConfirmation
}

export interface SubmissionItem {
  clientId: string
  imagePath: string
  originalFileName: string
  name: string
  game: CategoryRef
  character: CategoryRef & { isNew?: boolean }
  creationType: CategoryRef
  tags: string[]
  description: string
  updatedAt: string
  publisher: string
  sourceUrl?: string
  rights: {
    nonCommercialConfirmed: boolean
    responsibilityAccepted: boolean
  }
}

export interface SubmissionManifest {
  schemaVersion: 1
  generatedAt: string
  items: SubmissionItem[]
}
