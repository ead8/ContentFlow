import { createClient } from '@/lib/supabase/client'

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

/**
 * Upload a file to the user's folder in the public "media" bucket and return
 * its public URL. Storage policies only allow writes under <user_id>/.
 */
export async function uploadMedia(file: File, kind: 'image' | 'video'): Promise<string> {
  const allowed = kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES
  const max = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES

  if (!allowed.includes(file.type)) {
    throw new Error(
      kind === 'image' ? 'Use a PNG, JPEG, WebP or GIF image.' : 'Use an MP4, MOV or WebM video.'
    )
  }
  if (file.size > max) {
    throw new Error(`File is too large (max ${Math.round(max / 1024 / 1024)} MB).`)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You are signed out. Please sign in again.')

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const path = `${user.id}/uploads/${crypto.randomUUID()}.${ext || 'bin'}`

  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
