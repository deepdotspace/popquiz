import { useRef, useState } from 'react'
import { useR2Files } from 'deepspace'
import { Upload, Loader2, X, Music } from 'lucide-react'
import { Input } from '../ui'
import type { MediaType } from '../../lib/quiz-types'

interface Props {
  mediaType: MediaType
  mediaUrl: string
  onChange: (patch: { mediaType: MediaType; mediaUrl: string }) => void
}

const TABS: { value: MediaType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'youtube', label: 'YouTube' },
]

const ACCEPT: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
}

export function MediaEditor({ mediaType, mediaUrl, onChange }: Props) {
  const r2 = useR2Files()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [hover, setHover] = useState(false)

  const setTab = (t: MediaType) => {
    setError(null)
    onChange({ mediaType: t, mediaUrl: t === mediaType ? mediaUrl : '' })
  }

  async function handleUpload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const result = await r2.upload(file)
      const r = result as unknown as Record<string, unknown> | undefined
      let url = (r?.url as string) ?? (r?.publicUrl as string) ?? ''
      if (!url && r2.getUrl) {
        try {
          const got = await Promise.resolve(r2.getUrl(file as unknown as never))
          if (typeof got === 'string') url = got
        } catch {
          /* ignore — surface generic error below */
        }
      }
      if (!url && r && typeof r.key === 'string') {
        url = `/files/${r.key}`
      }
      if (!url) throw new Error('Upload returned no URL')
      onChange({ mediaType, mediaUrl: url })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {/* Plain text tabs with an underline that animates between them. */}
      <div className="flex items-center gap-5 border-b border-border">
        {TABS.map(({ value, label }) => {
          const active = mediaType === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                'relative -mb-px py-2 text-sm transition-colors ' +
                (active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80')
              }
            >
              {label}
              <span
                className={
                  'absolute inset-x-0 -bottom-px h-[2px] origin-left transition-transform duration-300 ease-out ' +
                  (active ? 'scale-x-100 bg-foreground' : 'scale-x-0 bg-foreground')
                }
                aria-hidden
              />
            </button>
          )
        })}
      </div>

      {mediaType !== 'none' && (
        <div className="mt-4">
          {mediaType === 'youtube' ? (
            <div className="space-y-3">
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=…"
                value={mediaUrl}
                onChange={(e) => onChange({ mediaType, mediaUrl: e.target.value })}
              />
              {mediaUrl && <YouTubePreview url={mediaUrl} />}
            </div>
          ) : mediaUrl ? (
            <UploadedPreview
              mediaType={mediaType}
              mediaUrl={mediaUrl}
              onRemove={() => onChange({ mediaType, mediaUrl: '' })}
            />
          ) : (
            <DropZone
              accept={ACCEPT[mediaType] ?? ''}
              uploading={uploading}
              hover={hover}
              setHover={setHover}
              kind={mediaType}
              onFile={(f) => void handleUpload(f)}
            />
          )}

          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------------
 * Drop zone — dashed border, fills with lime tint on drag-over / hover.
 * Click to browse; drop to upload.
 * -------------------------------------------------------------------- */

function DropZone({
  accept,
  uploading,
  hover,
  setHover,
  kind,
  onFile,
}: {
  accept: string
  uploading: boolean
  hover: boolean
  setHover: (v: boolean) => void
  kind: MediaType
  onFile: (f: File) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault()
        setHover(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      className={
        'flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm transition-colors ' +
        (hover
          ? 'border-primary bg-primary/15 text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:bg-secondary/50 hover:text-foreground')
      }
    >
      {uploading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Uploading…</span>
        </>
      ) : (
        <>
          <Upload className="h-5 w-5" />
          <span className="font-medium">
            Drop {kind === 'audio' ? 'an' : 'a'} {kind} here, or click to browse
          </span>
          <span className="text-xs text-muted-foreground">
            {kind === 'image' && 'PNG, JPG, GIF, WebP'}
            {kind === 'video' && 'MP4, WebM'}
            {kind === 'audio' && 'MP3, WAV, OGG'}
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
    </label>
  )
}

/* ----------------------------------------------------------------------
 * Preview of an uploaded file with a delete affordance.
 * -------------------------------------------------------------------- */

function UploadedPreview({
  mediaType,
  mediaUrl,
  onRemove,
}: {
  mediaType: MediaType
  mediaUrl: string
  onRemove: () => void
}) {
  if (mediaType === 'audio') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
        <Music className="h-4 w-4 shrink-0 text-muted-foreground" />
        <audio src={mediaUrl} controls className="h-9 flex-1" />
        <RemoveButton onClick={onRemove} />
      </div>
    )
  }

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-card">
      {mediaType === 'image' && (
        <img
          src={mediaUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      )}
      {mediaType === 'video' && (
        <video src={mediaUrl} controls className="h-full w-full object-cover" />
      )}
      <div className="absolute right-2 top-2">
        <RemoveButton onClick={onRemove} solid />
      </div>
    </div>
  )
}

function RemoveButton({ onClick, solid }: { onClick: () => void; solid?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove media"
      className={
        'inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ' +
        (solid
          ? 'bg-foreground/80 text-background hover:bg-foreground'
          : 'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive')
      }
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

/* ----------------------------------------------------------------------
 * YouTube live preview.
 * -------------------------------------------------------------------- */

function YouTubePreview({ url }: { url: string }) {
  const id = parseYouTubeId(url)
  if (!id) {
    return (
      <p className="text-xs text-muted-foreground">
        Paste a YouTube URL to see the preview.
      </p>
    )
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-card">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="YouTube preview"
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.searchParams.get('v')) return u.searchParams.get('v')
    const m = u.pathname.match(/\/embed\/([\w-]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}
