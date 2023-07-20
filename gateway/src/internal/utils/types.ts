export interface NameDefinition {
  id: string
  network: string
  validityGuaranty: number
  address: string
}

export interface ExchangeEndpoint {
  url: string
  encryptedSigningKey: string
}

export interface Env {
  EXCHANGES: KVNamespace
  NAMES: KVNamespace
  RESPONSE_SIGNING_KEY: string // secret
  CEXDATA_ENCRYPTION_KEY: string // secret
  BASE_PATH: string
}
