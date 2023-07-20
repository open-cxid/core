import { uint8ArrayToHex } from './serialization'

const nonceChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Make a request to an exchange endpoint. The endpoint is either directly exposed by the
 * exchange or a middleware built by CXID over the exchange's core endpoints and conforms
 * to the integration specifications for CXID
 *
 * @param endpointUrl
 * @param params
 * @param signingKey
 */
export async function makeRequest<T>(
  endpointUrl: string,
  params: string,
  signingKey: ArrayBuffer
): Promise<T | null> {
  const url = new URL(endpointUrl)
  url.search += params

  const nonce = generateNonce()
  const timestamp = Date.now()
  const queryString = url.search.slice(1)
  const signature = await hmacSHA256(`${timestamp}:${nonce}:${queryString}`, signingKey)

  try {
    const response = await fetch(url, {
      headers: {
        'CXID-TIMESTAMP': timestamp.toString(),
        'CXID-NONCE': nonce,
        'CXID-SIGNATURE': signature,
      },
    })
    return JSON.parse(await validateResponse(response, signingKey)) as T
  } catch (e) {
    console.error('An error occurred while resolving the name from the API: ', e)
    return null
  }
}

async function validateResponse(response: Response, signingKey: ArrayBuffer): Promise<string> {
  const responseData = await response.text()
  const signature = await hmacSHA256(responseData, signingKey)
  if (response.headers.get('CXID-SIGNATURE')?.toLowerCase() !== signature.toLowerCase()) {
    throw Error(
      'Invalid signature from exchange. Key might be invalid or exchange might be compromised'
    )
  }
  return responseData
}

async function hmacSHA256(data: string, signingKey: ArrayBuffer) {
  const key = await getHMACSigningKey(signingKey)
  const encodedData = new TextEncoder().encode(data)
  const signed = await crypto.subtle.sign('HMAC', key, encodedData)
  return uint8ArrayToHex(new Uint8Array(signed))
}

function getHMACSigningKey(signingKey: ArrayBuffer) {
  return crypto.subtle.importKey(
    'raw',
    signingKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )
}

function generateNonce(length = 32) {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += nonceChars[Math.floor(Math.random() * nonceChars.length)]
  }
  return result
}
