import { hexToUint8Array } from './serialization'

/**
 * The total length of a key here is 40 bytes.
 * The first 12 bytes of the key make up the IV.
 * The remaining 32 bytes make up the key.
 */
const keyRegex = /[0-9a-f]{80}/
const hexRegex = /[0-9a-f]{2,}/

export async function decryptData(encryptionKey: string, ciphertext: string): Promise<ArrayBuffer> {
  if (!keyRegex.test(encryptionKey)) {
    throw Error('The encryption key is invalid')
  }
  if (ciphertext.length % 2 !== 0 || !hexRegex.test(ciphertext)) {
    throw Error('The ciphertext is invalid')
  }

  const ivBytes = hexToUint8Array(encryptionKey.substring(0, 24))
  const keyBytes = hexToUint8Array(encryptionKey.substring(24))
  const ciphertextBytes = hexToUint8Array(ciphertext)

  const decryptionKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'decrypt',
  ])
  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    decryptionKey,
    ciphertextBytes
  )
}
