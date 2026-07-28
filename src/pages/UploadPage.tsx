import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGalleryMetadata } from '@/lib/api'
import {
  BASE_CHARACTERS,
  CREATION_TYPES,
  GAME,
  ISSUE_FORM_URL,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from '@/lib/constants'
import {
  buildSubmissionPackage,
  parseTags,
  type SubmissionSource,
} from '@/lib/submission'
import type { SubmissionItem } from '@/types/gallery'
import type { CategoryRef } from '@/types/gallery'

interface UploadDraft {
  clientId: string
  file: File
  previewUrl: string
  name: string
  characterId: string
  customCharacterLabel: string
  creationTypeId: string
  tags: string
  description: string
  updatedAt: string
  publisher: string
  sourceUrl: string
}

interface PreparedPackage {
  blob: Blob
  fileName: string
}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const TODAY = new Date().toISOString().slice(0, 10)

function createClientId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createDraft(file: File): UploadDraft {
  return {
    clientId: createClientId(),
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name.replace(/\.[^.]+$/, ''),
    characterId: BASE_CHARACTERS[0].id,
    customCharacterLabel: '',
    creationTypeId: CREATION_TYPES[0].id,
    tags: '',
    description: '',
    updatedAt: TODAY,
    publisher: 'MiHoYo',
    sourceUrl: '',
  }
}

export function UploadPage() {
  const [drafts, setDrafts] = useState<UploadDraft[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparedPackage, setPreparedPackage] =
    useState<PreparedPackage | null>(null)
  const previewUrls = useRef(new Set<string>())
  const metadataQuery = useQuery({
    queryKey: ['gallery-metadata'],
    queryFn: fetchGalleryMetadata,
  })
  const characters = [
    ...new Map<string, CategoryRef>(
      [
        ...BASE_CHARACTERS,
        ...(metadataQuery.data?.items.map((item) => item.character) ?? []),
      ].map((character) => [character.id, character]),
    ).values(),
  ]

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files)
    const nextErrors: string[] = []
    const accepted: UploadDraft[] = []

    if (drafts.length + incoming.length > MAX_IMAGES) {
      nextErrors.push(`每次最多选择 ${MAX_IMAGES} 张图片。`)
    }

    incoming.slice(0, Math.max(0, MAX_IMAGES - drafts.length)).forEach((file) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        nextErrors.push(`${file.name}：仅支持 JPG、PNG、WEBP。`)
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        nextErrors.push(`${file.name}：文件超过 10 MB。`)
        return
      }
      const draft = createDraft(file)
      previewUrls.current.add(draft.previewUrl)
      accepted.push(draft)
    })

    setDrafts((current) => [...current, ...accepted])
    if (accepted.length > 0) setRightsConfirmed(false)
    setErrors(nextErrors)
    setPreparedPackage(null)
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    addFiles(event.dataTransfer.files)
  }

  function updateDraft<K extends keyof UploadDraft>(
    clientId: string,
    key: K,
    value: UploadDraft[K],
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.clientId === clientId ? { ...draft, [key]: value } : draft,
      ),
    )
    setPreparedPackage(null)
  }

  function removeDraft(clientId: string) {
    setDrafts((current) => {
      const draft = current.find((item) => item.clientId === clientId)
      if (draft) {
        URL.revokeObjectURL(draft.previewUrl)
        previewUrls.current.delete(draft.previewUrl)
      }
      return current.filter((item) => item.clientId !== clientId)
    })
    setRightsConfirmed(false)
    setPreparedPackage(null)
  }

  function buildManifestItem(draft: UploadDraft): SubmissionItem {
    const selectedCharacter = characters.find(
      (character) => character.id === draft.characterId,
    )
    const selectedCreationType = CREATION_TYPES.find(
      (type) => type.id === draft.creationTypeId,
    )

    return {
      clientId: draft.clientId,
      imagePath: `images/${draft.clientId}.jpg`,
      originalFileName: draft.file.name,
      name: draft.name.trim(),
      game: GAME,
      character:
        draft.characterId === 'new'
          ? {
              id: 'new',
              label: draft.customCharacterLabel.trim(),
              isNew: true,
            }
          : (selectedCharacter ?? BASE_CHARACTERS[0]),
      creationType: selectedCreationType ?? CREATION_TYPES[0],
      tags: parseTags(draft.tags),
      description: draft.description.trim(),
      updatedAt: draft.updatedAt,
      publisher: draft.publisher.trim(),
      sourceUrl: draft.sourceUrl.trim(),
      rights: {
        nonCommercialConfirmed: rightsConfirmed,
        responsibilityAccepted: rightsConfirmed,
      },
    }
  }

  function validateDrafts(): string[] {
    if (drafts.length === 0) return ['请先选择至少一张图片。']
    const nextErrors: string[] = []

    drafts.forEach((draft, index) => {
      const prefix = `第 ${index + 1} 张图片`
      if (!draft.name.trim()) nextErrors.push(`${prefix}：请填写名称。`)
      if (
        draft.characterId === 'new' &&
        !draft.customCharacterLabel.trim()
      ) {
        nextErrors.push(`${prefix}：请填写新角色名称。`)
      }
      if (!draft.publisher.trim()) {
        nextErrors.push(`${prefix}：请填写发布者。`)
      }
      if (draft.sourceUrl.trim()) {
        try {
          const url = new URL(draft.sourceUrl)
          if (url.protocol !== 'https:') throw new Error()
        } catch {
          nextErrors.push(`${prefix}：来源链接需要使用有效的 HTTPS 地址。`)
        }
      }
      if (!draft.updatedAt) nextErrors.push(`${prefix}：请选择更新时间。`)
      if (parseTags(draft.tags).length > 12) {
        nextErrors.push(`${prefix}：标签最多 12 个。`)
      }
    })

    if (!rightsConfirmed) {
      nextErrors.push('请确认本次投稿的非商业使用要求与版权责任。')
    }

    return nextErrors
  }

  async function prepareSubmission() {
    const validationErrors = validateDrafts()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setErrors([])
    setIsPreparing(true)
    try {
      const sources: SubmissionSource[] = drafts.map((draft) => ({
        file: draft.file,
        manifest: buildManifestItem(draft),
      }))
      const result = await buildSubmissionPackage(sources)
      setPreparedPackage({ blob: result.blob, fileName: result.fileName })
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : '整合文件生成失败，请重试。',
      ])
    } finally {
      setIsPreparing(false)
    }
  }

  function downloadPackage() {
    if (!preparedPackage) return
    const url = URL.createObjectURL(preparedPackage.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = preparedPackage.fileName
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="upload-page">
      <header className="page-heading upload-heading">
        <div>
          <p className="section-kicker">ADD TO THE ALBUM</p>
          <h1>为旅途留下一张照片</h1>
          <p>
            图片只会在本地整理成投稿包；前往 GitHub 提交后，经审核收录进旅途相册。
          </p>
        </div>
        <p className="result-count">
          <strong>{drafts.length}</strong>
          <span>/ {MAX_IMAGES} 张</span>
        </p>
      </header>

      {errors.length > 0 && (
        <div className="form-errors" role="alert">
          <strong>请先处理以下问题：</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <label
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileInput}
        />
        <span className="drop-zone__symbol" aria-hidden="true">
          +
        </span>
        <strong>选一张值得记住的照片</strong>
        <span>支持 JPG、PNG、WEBP · 单张不超过 10 MB</span>
      </label>

      <div className="upload-list">
        {drafts.map((draft, index) => (
          <article className="upload-card" key={draft.clientId}>
            <div className="upload-card__preview">
              <img src={draft.previewUrl} alt="" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="upload-card__form">
              <div className="upload-card__title">
                <div>
                  <p>图片信息</p>
                  <h2>{draft.file.name}</h2>
                </div>
                <button
                  type="button"
                  className="text-button text-button--danger"
                  onClick={() => removeDraft(draft.clientId)}
                >
                  移除
                </button>
              </div>

              <div className="form-grid">
                <label>
                  <span>名称 *</span>
                  <input
                    value={draft.name}
                    maxLength={80}
                    onChange={(event) =>
                      updateDraft(draft.clientId, 'name', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>游戏</span>
                  <input value={GAME.label} disabled />
                </label>
                <label>
                  <span>角色 *</span>
                  <select
                    value={draft.characterId}
                    onChange={(event) =>
                      updateDraft(
                        draft.clientId,
                        'characterId',
                        event.target.value,
                      )
                    }
                  >
                    {characters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.label}
                      </option>
                    ))}
                    <option value="new">＋ 新角色</option>
                  </select>
                </label>
                {draft.characterId === 'new' && (
                  <label>
                    <span>新角色名称 *</span>
                    <input
                      value={draft.customCharacterLabel}
                      maxLength={80}
                      onChange={(event) =>
                        updateDraft(
                          draft.clientId,
                          'customCharacterLabel',
                          event.target.value,
                        )
                      }
                      placeholder="请输入角色正式名称"
                    />
                  </label>
                )}
                <label>
                  <span>创作类型 *</span>
                  <select
                    value={draft.creationTypeId}
                    onChange={(event) =>
                      updateDraft(
                        draft.clientId,
                        'creationTypeId',
                        event.target.value,
                      )
                    }
                  >
                    {CREATION_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>更新时间（固定为当日）</span>
                  <input
                    type="date"
                    value={draft.updatedAt}
                    disabled
                  />
                </label>
                <label>
                  <span>发布者 *</span>
                  <input
                    value={draft.publisher}
                    maxLength={100}
                    onChange={(event) =>
                      updateDraft(
                        draft.clientId,
                        'publisher',
                        event.target.value,
                      )
                    }
                    placeholder="作者或官方发布方"
                  />
                </label>
                <label className="form-grid__wide">
                  <span>来源链接（可选）</span>
                  <input
                    type="url"
                    value={draft.sourceUrl}
                    onChange={(event) =>
                      updateDraft(
                        draft.clientId,
                        'sourceUrl',
                        event.target.value,
                      )
                    }
                    placeholder="https://"
                  />
                </label>
                <label className="form-grid__wide">
                  <span>标签</span>
                  <input
                    value={draft.tags}
                    onChange={(event) =>
                      updateDraft(draft.clientId, 'tags', event.target.value)
                    }
                    placeholder="使用逗号分隔，最多 12 个"
                  />
                </label>
                <label className="form-grid__wide">
                  <span>详细描述（可选）</span>
                  <textarea
                    value={draft.description}
                    maxLength={2000}
                    onChange={(event) =>
                      updateDraft(
                        draft.clientId,
                        'description',
                        event.target.value,
                      )
                    }
                    rows={4}
                    placeholder="写下画面内容、出处，以及你想替三月七留住的细节"
                  />
                </label>
              </div>

            </div>
          </article>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="rights-checks rights-checks--batch">
          <label>
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(event) => {
                setRightsConfirmed(event.target.checked)
                setPreparedPackage(null)
              }}
            />
            <span>
              我确认本次投稿中的所有图片符合本站非商业展示与下载要求，并理解且承担相应版权责任。
            </span>
          </label>
        </div>
      )}

      <div className="upload-next">
        <div>
          <strong>把这段记忆送进相册？</strong>
          <span>下一步会在本地整理包含图片与信息的投稿包。</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => void prepareSubmission()}
          disabled={isPreparing}
        >
          {isPreparing ? '正在整合…' : '下一步'}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {preparedPackage && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreparedPackage(null)
          }}
        >
          <section
            className="submission-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setPreparedPackage(null)}
              aria-label="关闭提示框"
            >
              ×
            </button>
            <p className="section-kicker">MEMORY READY</p>
            <h2 id="submission-title">这段记忆已整理好</h2>
            <p>请按顺序完成以下步骤。GitHub Issue 创建后，机器人会自动校验并准备 PR。</p>
            <ol className="submission-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>保存投稿包</strong>
                  <p>{preparedPackage.fileName}</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>前往投稿通道</strong>
                  <p>登录 GitHub，在专用表单中上传刚刚下载的 ZIP。</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>提交并等待收录</strong>
                  <p>机器人会在 Issue 中回复校验结果和 PR 链接。</p>
                </div>
              </li>
            </ol>
            <div className="submission-modal__actions">
              <button
                className="secondary-button"
                type="button"
                onClick={downloadPackage}
              >
                下载 ZIP
              </button>
              <a
                className="primary-button"
                href={ISSUE_FORM_URL}
                target="_blank"
                rel="noreferrer"
              >
                前往 GitHub Issue
                <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="privacy-note">
              公开仓库中的 Issue 附件可以被任何人访问，请勿在投稿包中加入隐私信息。
            </p>
          </section>
        </div>
      )}
    </section>
  )
}
