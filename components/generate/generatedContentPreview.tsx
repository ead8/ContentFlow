import { ContentGenerationResponse } from '@/models/content'
import { platformLabel } from '@/lib/platforms'

interface ContentPreviewProps {
  data: ContentGenerationResponse
}

/**
 * Read-only preview of the AI output, one card per platform.
 */
const ContentPreviewComponent = ({ data }: ContentPreviewProps) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{data.name}</h3>
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(data.platform_posts).map(([platform, post]) => (
          <div key={platform} className="rounded-lg border bg-card p-4 space-y-3 text-sm">
            <h4 className="font-semibold">{platformLabel(platform)}</h4>
            {(post.post || post.caption) && (
              <p className="whitespace-pre-wrap leading-relaxed">{post.post || post.caption}</p>
            )}
            {post.call_to_action && (
              <p>
                <span className="font-medium">Call to action: </span>
                {post.call_to_action}
              </p>
            )}
            {post.hashtags && post.hashtags.length > 0 && (
              <p className="text-primary">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>
            )}
            {post.image_suggestion && (
              <p className="text-muted-foreground">
                <span className="font-medium">Image idea: </span>
                {post.image_suggestion}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ContentPreviewComponent
