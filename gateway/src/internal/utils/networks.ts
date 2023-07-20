import { isValidName } from 'ethers'
import slips from 'bip44-constants'

export function normalizeIdAndNetwork({
  id,
  network,
}: {
  id: string | undefined
  network: string | number | undefined
}): { id: string; network: string } | null {
  id = id?.toLowerCase()
  if (!id || !isValidName(id)) {
    return null
  }

  // name is valid, now check network
  network = Number(network)
  if (isNaN(network)) {
    return null
  }

  if (network < 0x80000000) {
    network += 0x80000000
  }

  for (const slip of slips) {
    if (slip[0] === network) {
      // network is valid, return true
      return { id, network: network.toString().toLowerCase() }
    }
  }

  return null
}

export function validateIdAndNetwork(id: string | undefined, network: string): boolean {
  const result = normalizeIdAndNetwork({ id, network })
  return !!result
}
