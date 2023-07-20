import { decryptData, ExchangeEndpoint, makeRequest, NameDefinition } from './utils'
import { normalizeIdAndNetwork } from './utils/networks'

export async function getNameDataFromExchange(
  rawId: string,
  rawNetwork: string,
  encryptionKey: string,
  endpoint: ExchangeEndpoint
): Promise<NameDefinition | null> {
  console.log(`Attempting to resolve ${rawId} from the exchange`)
  const requestIdAndNetwork = normalizeIdAndNetwork({ id: rawId, network: rawNetwork })
  if (!requestIdAndNetwork) {
    return null
  }

  const { id, network } = requestIdAndNetwork
  const signingKey = await getSigningKey(id, encryptionKey, endpoint)
  if (!signingKey) {
    console.error('FATAL: Failed to load exchange signing key')
    return null
  }

  const encodedId = encodeURIComponent(id)
  const encodedNetwork = encodeURIComponent(network)
  const queryParams = `id=${encodedId}&network=${encodedNetwork}`
  const response = await makeRequest<Partial<NameDefinition>>(endpoint.url, queryParams, signingKey)
  if (!response) {
    console.error(`Name ${id} could not be resolved from the exchange`)
    return null
  }

  const responseIdAndNetwork = normalizeIdAndNetwork({ id: response.id, network: response.network })
  if (!responseIdAndNetwork) {
    return null
  }

  const { id: responseId, network: responseNetwork } = responseIdAndNetwork
  if (responseId !== id || responseNetwork !== network) {
    console.error('ID or network from the exchange do not match the sent values')
    return null
  }

  if (!response.validityGuaranty) {
    response.validityGuaranty = 0
  }

  if (!response.address) {
    console.error('ADDRESS NOT RESOLVED FROM THE EXCHANGE')
    return null
  }

  return {
    id: id,
    network: network,
    address: response.address,
    validityGuaranty: response.validityGuaranty,
  }
}

async function getSigningKey(name: string, encryptionKey: string, endpoint: ExchangeEndpoint) {
  try {
    new URL(endpoint.url).toString()
  } catch {
    console.error('FATAL: endpoint URL is invalid')
    console.debug(`INVALID ENDPOINT URL => name: ${name}, url: ${endpoint.url}`)
    return null
  }

  try {
    return await decryptData(encryptionKey, endpoint.encryptedSigningKey)
  } catch (e) {
    console.error('FATAL: failed to decrypt exchange HS256 key')
    console.error(e)
    console.debug(
      `KEY DECRYPTION FAILED => failed to decrypt exchange HS256 key. name: ${name} url: ${endpoint.url}`
    )
    return null
  }
}
