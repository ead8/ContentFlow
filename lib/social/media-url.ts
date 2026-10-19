/**
 * Media URL policy for publishing.
 *
 * The publisher downloads post media server-side and re-uploads it to the
 * user's social account, so an arbitrary URL would let a user make the server
 * fetch internal addresses (cloud metadata, localhost, private hosts) and read
 * the response back through their own post (SSRF). Media must therefore live
 * in the post owner's folder of our public "media" storage bucket, and
 * downloads never follow redirects.
 */

const BUCKET_PATH = '/storage/v1/object/public/media/'

function storageOrigin(): URL | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  } catch {
    return null
  }
}

/**
 * Returns null when the URL is an allowed media URL for `ownerId`,
 * otherwise a user-facing reason.
 */
export function mediaUrlProblem(raw: string, ownerId: string): string | null {
  const origin = storageOrigin()
  if (!origin) return 'Media storage is not configured.'

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'A media link is not a valid URL.'
  }

  // Plain http only when storage itself is http (local development)
  const allowedProtocol = url.protocol === 'https:' || (origin.protocol === 'http:' && url.protocol === 'http:')
  if (!allowedProtocol || url.origin !== origin.origin || url.username || url.password) {
    return 'Media must be uploaded to ContentFlow. Re-add the image or video from your media library.'
  }

  const prefix = `${BUCKET_PATH}${ownerId}/`
  // Decode once so encoded traversal (%2e%2e) is caught too
  let path: string
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    return 'A media link is not a valid URL.'
  }
  if (!path.startsWith(prefix) || path.includes('/../') || path.includes('\\')) {
    return 'Media must be uploaded to ContentFlow. Re-add the image or video from your media library.'
  }

  return null
}

export function assertAllowedMediaUrls(urls: string[], ownerId: string): void {
  for (const u of urls) {
    const problem = mediaUrlProblem(u, ownerId)
    if (problem) throw new Error(problem)
  }
}
