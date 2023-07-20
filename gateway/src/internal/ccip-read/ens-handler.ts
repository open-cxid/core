import { Env } from '../utils'
import { ResolveFragment, ResolverInterface } from '../abi'
import {
  AbiCoder,
  BytesLike,
  hexlify,
  keccak256,
  Result,
  SigningKey,
  solidityPackedKeccak256,
  namehash,
  ensNormalize,
} from 'ethers'
import { resolveName } from '../resolver'
import { hexToUint8Array } from '../utils/serialization'

type RPCCall = {
  to: string
  data: string
}

export async function handleCCIP(call: RPCCall, env: Env): Promise<string> {
  const selector = call.data.substring(0, 10).toLowerCase()
  if (selector !== ResolveFragment.selector) {
    throw Error('Unsupported function received')
  }

  const fragment = ResolveFragment
  const abiCoder = AbiCoder.defaultAbiCoder()
  const args = abiCoder.decode(fragment.inputs, `0x${call.data.substring(10)}`)
  const response = await handleResolve(args, call, env)
  return fragment.outputs ? hexlify(abiCoder.encode(fragment.outputs, response)) : '0x'
}

async function handleResolve(
  [encodedName, data]: Result,
  call: RPCCall,
  env: Env
): Promise<Array<BytesLike | number>> {
  const name = decodeDNSName(hexToUint8Array(encodedName.slice(2)))

  // Query the database
  const { result, validity } = await query(env, name, data)

  // Hash and sign the response
  const messageHash = solidityPackedKeccak256(
    ['bytes', 'address', 'uint64', 'bytes32', 'bytes32'],
    ['0x1900', call.to, validity, keccak256(call.data || '0x'), keccak256(result)]
  )
  const signingKey = new SigningKey(env.RESPONSE_SIGNING_KEY)
  const signature = signingKey.sign(messageHash).serialized
  return [result, validity, signature]
}

const queryHandlers: {
  [key: string]: (
    env: Env,
    name: string,
    args: Result
  ) => Promise<{ result: string[]; validity: number } | null>
} = {
  'addr(bytes32)': async (env, name) => {
    const nameData = await resolveName(
      name,
      '60',
      env.CEXDATA_ENCRYPTION_KEY,
      env.EXCHANGES,
      env.NAMES
    )
    return nameData && { result: [nameData.address], validity: nameData.validityGuaranty }
  },
  'addr(bytes32,uint256)': async (env, name, args) => {
    const nameData = await resolveName(
      name,
      args[0],
      env.CEXDATA_ENCRYPTION_KEY,
      env.EXCHANGES,
      env.NAMES
    )
    return nameData && { result: [nameData.address], validity: nameData.validityGuaranty }
  },
  'text(bytes32,string)': async () => {
    // not supported yet
    return null
  },
  'contenthash(bytes32)': async () => {
    // not supported yet
    return null
  },
}

async function query(
  env: Env,
  name: string,
  data: string
): Promise<{ result: BytesLike; validity: number }> {
  // Parse the data nested inside the second argument to `resolve`
  const { signature, args } = ResolverInterface.parseTransaction({ data })!

  if (ensNormalize(name) !== name) {
    throw new Error('Name must be normalised')
  }

  if (namehash(name) !== args[0]) {
    throw new Error('Name does not match namehash')
  }

  const handler = queryHandlers[signature]
  if (handler === undefined) {
    throw new Error(`Unsupported query function ${signature}`)
  }

  const result = await handler(env, name, args.slice(1))
  if (!result) {
    throw Error('Failed to resolve name')
  }

  console.log('result, validity', result.result, result.validity)
  return {
    result: ResolverInterface.encodeFunctionResult(signature, result.result),
    validity: Math.floor(result.validity / 1000),
  }
}

function decodeDNSName(val: Uint8Array): string {
  const parts: string[] = []
  let offset = 0
  while (true) {
    const len = val[offset]
    if (len === 0) break
    let decoded = ''
    for (let i = offset + 1; i < offset + len + 1; i++) {
      decoded = decoded + String.fromCharCode(val[i])
    }
    offset += len + 1
    parts.push(decoded)
  }
  return parts.join('.')
}
