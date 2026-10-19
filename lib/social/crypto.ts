import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

/**
 * Encryption at rest for OAuth tokens stored in social_accounts.
 *
 * Format: `v1:<iv b64>:<auth tag b64>:<ciphertext b64>` (AES-256-GCM).
 * The key is 32 random bytes, base64-encoded, in TOKEN_ENCRYPTION_KEY
 * (generate one with `openssl rand -base64 32`). Server-only.
 */

const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16

const KEY_ERROR =
  'TOKEN_ENCRYPTION_KEY is not configured (it must be 32 bytes, base64-encoded — generate one with `openssl rand -base64 32`)'

let cachedKey: { raw: string; key: Buffer } | null = null

/** The 32-byte key from TOKEN_ENCRYPTION_KEY; throws when missing or invalid */
export function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error(KEY_ERROR)
  if (cachedKey && cachedKey.raw === raw) return cachedKey.key

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error(KEY_ERROR)

  cachedKey = { raw, key }
  return key
}

/** True when TOKEN_ENCRYPTION_KEY is set to a valid 32-byte key */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

export function encryptToken(plain: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decryptToken(enc: string): string {
  const key = getEncryptionKey()
  const parts = typeof enc === 'string' ? enc.split(':') : []
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Stored token is not in the expected encrypted format')
  }

  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const ciphertext = Buffer.from(parts[3], 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Stored token is not in the expected encrypted format')
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES })
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    // Wrong key (rotated?) or tampered data. Never include the token itself.
    throw new Error('Stored token could not be decrypted')
  }
}
