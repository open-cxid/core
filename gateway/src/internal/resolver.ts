import { ExchangeEndpoint, NameDefinition } from './utils'
import { getNameDataFromExchange } from './integration'
import { validateIdAndNetwork } from './utils/networks'

export async function resolveName(
  name: string,
  network: string,
  cexDataEncryptionKey: string,
  exchangeKV: KVNamespace,
  namesKV: KVNamespace
): Promise<NameDefinition | null> {
  console.log(`Resolving name: ${name}`)

  if (!validateIdAndNetwork(name, network)) {
    console.error(`Invalid name: ${name} or network: ${network}`)
    return null
  }

  const nameParts = name.split('.')
  if (nameParts.length === 1) {
    console.log(`TLD name ${name} cannot be resolved`)
    return null
  }

  const cachedNameData = await loadCachedNameData(name, network, namesKV)
  if (cachedNameData?.validityGuaranty && cachedNameData.validityGuaranty > Date.now()) {
    return cachedNameData
  }

  const loadedNameData = await loadNameDataFromExchange(
    nameParts,
    network,
    cexDataEncryptionKey,
    exchangeKV
  )
  if (!loadedNameData) {
    return null
  }

  // if it'd expire in 10 minutes or less, don't save
  const tenMinutes = 600000
  if (
    loadedNameData.validityGuaranty &&
    loadedNameData.validityGuaranty > Date.now() + tenMinutes
  ) {
    await namesKV.put(`${name}::${network}`, JSON.stringify(loadedNameData), {
      expiration: loadedNameData.validityGuaranty,
    })
  }
  loadedNameData.validityGuaranty = Date.now() + tenMinutes / 10
  return loadedNameData
}

async function loadNameDataFromExchange(
  nameParts: string[],
  network: string,
  cexDataEncryptionKey: string,
  exchangeKV: KVNamespace
): Promise<NameDefinition | null> {
  const idData = await loadUserExchangeId(nameParts, exchangeKV)
  if (!idData) {
    console.error(`Exchange ID not found for name: ${nameParts.join('.')}`)
    return null
  }

  const { userId, exchangeId } = idData
  const endpointData = (await exchangeKV.get(
    `${exchangeId}:endpointData`,
    'json'
  )) as ExchangeEndpoint

  if (
    !endpointData ||
    typeof endpointData !== 'object' ||
    !endpointData.url ||
    !endpointData.encryptedSigningKey
  ) {
    console.error('FATAL: Invalid exchange endpoint data stored')
    return null
  }

  return await getNameDataFromExchange(
    userId,
    network,
    cexDataEncryptionKey,
    endpointData as ExchangeEndpoint
  )
}

async function loadCachedNameData(
  name: string,
  network: string,
  namesKV: KVNamespace
): Promise<NameDefinition | undefined> {
  const cachedNameData = await namesKV.get(`${name}::${network}`, 'json')
  if (
    cachedNameData &&
    typeof cachedNameData === 'object' &&
    'id' in cachedNameData &&
    cachedNameData.id === name
  ) {
    return cachedNameData as NameDefinition
  }
}

async function loadUserExchangeId(
  nameParts: string[],
  exchangeKV: KVNamespace,
  parts = 2
): Promise<{ userId: string; exchangeId: string } | null> {
  const subdomainToTry = nameParts.slice(nameParts.length - parts, nameParts.length).join('.')
  console.log('trying', `cxid-generic:${subdomainToTry}:id`)
  const exchangeId = await exchangeKV.get(`cxid-generic:${subdomainToTry}:id`)
  if (exchangeId) {
    return {
      userId: nameParts.slice(0, nameParts.length - parts).join('.'),
      exchangeId,
    }
  }

  console.log("didn't get exchange id", `cxid-generic:${subdomainToTry}:id`)
  if (nameParts.length === parts) {
    return null
  }

  return await loadUserExchangeId(nameParts, exchangeKV, parts + 1)
}
