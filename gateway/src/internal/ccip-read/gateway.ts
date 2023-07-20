import { handleCCIP } from './ens-handler'
import { Env } from '../utils'
import { isAddress, isBytesLike } from 'ethers'

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  console.log(`${request.method} ${url.pathname}`)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (url.pathname === env.BASE_PATH) {
    return referResponse(200)
  }

  try {
    const { sender, calldata } = await getParams(env.BASE_PATH, request)
    const data = await handleCCIP({ to: sender, data: calldata }, env)
    return new Response(JSON.stringify({ data }), {
      headers: {
        'content-type': 'application/json',
      },
    })
  } catch (e) {
    console.error(e)
    return referResponse()
  }
}

async function getParams(
  basePath: string,
  request: Request
): Promise<{ sender: string; calldata: string }> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    throw new Error()
  }

  const path = request.url.match(/https?:\/\/[^/]+(.+)/)![1]
  if (!path.startsWith(basePath) || !path.endsWith('.json')) {
    throw new Error()
  }

  const urlSplit = path.substring(basePath.length).split('/')
  if (urlSplit.length > 2) {
    throw new Error()
  }

  let requestBody: { data: string } | undefined
  try {
    requestBody = request.method === 'POST' ? await request.json() : undefined
  } catch {}

  let [sender, calldata] = urlSplit
  calldata = calldata || requestBody?.data || ''
  if (!sender || !calldata) {
    throw new Error()
  }

  if (sender.endsWith('.json')) {
    sender = sender.substring(0, sender.length - 5)
  }

  if (calldata.endsWith('.json')) {
    calldata = calldata.substring(0, calldata.length - 5)
  }

  if (!isAddress(sender) || !isBytesLike(calldata)) {
    throw new Error()
  }

  return { sender, calldata }
}

function referResponse(status = 404) {
  return new Response(
    'CXID: Bringing ENS to cryptocurrency exchanges. Check out https://cxid.io for more information',
    {
      status: status,
    }
  )
}
