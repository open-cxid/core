/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { OffchainResolver } from '../build/types'
import { arrayify, defaultAbiCoder, Interface } from 'ethers/lib/utils'
import { utils } from 'ethers'
const { Wallet } = ethers

const TEST_ADDRESS = '0xCAfEcAfeCAfECaFeCaFecaFecaFECafECafeCaFe'

describe('OffchainResolver', () => {
  let trustedSigner: utils.SigningKey
  let resolver: OffchainResolver
  let snapshot: any

  before(async () => {
    trustedSigner = Wallet.createRandom()._signingKey()

    const offchainResolverFactory = await ethers.getContractFactory('OffchainResolver')
    resolver = (await offchainResolverFactory.deploy('http://localhost:8080/', [
      utils.computeAddress(trustedSigner.privateKey),
    ])) as OffchainResolver
  })

  beforeEach(async () => {
    snapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [snapshot])
  })

  describe('supportsInterface()', () => {
    it('supports known interfaces', async () => {
      expect(await resolver.supportsInterface('0x9061b923')).to.equal(true) // IExtendedResolver
    })

    it('does not support a random interface', async () => {
      expect(await resolver.supportsInterface('0x3b3b57df')).to.equal(false)
    })
  })

  describe('resolve()', () => {
    it('returns a CCIP-read error', async () => {
      await expect(resolver.resolve(dnsName('test.eth'), '0x')).to.be.revertedWith(
        'OffchainLookup',
      )
    })
  })

  describe('resolveWithProof()', () => {
    let name: string,
      expires: number,
      iface: Interface,
      callData: string,
      resultData: string,
      signature: string

    before(async () => {
      name = 'test.eth'
      expires = Math.floor(Date.now() / 1000 + 3600)

      // Encode the nested call to 'addr'
      iface = new ethers.utils.Interface(['function addr(bytes32) returns(address)'])
      const addrData = iface.encodeFunctionData('addr', [ethers.utils.namehash(name)])

      // Encode the outer call to 'resolve'
      callData = resolver.interface.encodeFunctionData('resolve', [
        dnsName(name),
        addrData,
      ])

      // Encode the result data
      resultData = iface.encodeFunctionResult('addr', [TEST_ADDRESS])

      // Generate a signature hash for the response from the gateway
      const callDataHash = await resolver.makeSignatureHash(
        resolver.address,
        expires,
        callData,
        resultData,
      )

      // Sign it
      const { r, s, v } = trustedSigner.signDigest(callDataHash)
      signature = utils.hexConcat([r, s, '0x' + v.toString(16).padStart(2, '0')])
      console.log('sig len:', signature.length)
      console.log('sig:', signature)
    })

    it('resolves an address given a valid signature', async () => {
      // Generate the response data
      const response = defaultAbiCoder.encode(
        ['bytes', 'uint64', 'bytes'],
        [resultData, expires, signature],
      )

      // Call the function with the request and response
      const [result] = iface.decodeFunctionResult(
        'addr',
        await resolver.resolveWithProof(response, callData),
      )
      expect(result).to.equal(TEST_ADDRESS)
    })

    it('reverts given an invalid signature', async () => {
      // Corrupt the sig
      const deadsig = arrayify(signature).slice()
      deadsig[0] = deadsig[0] + 1

      // Generate the response data
      const response = defaultAbiCoder.encode(
        ['bytes', 'uint64', 'bytes'],
        [resultData, expires, deadsig],
      )

      // Call the function with the request and response
      await expect(resolver.resolveWithProof(response, callData)).to.be.reverted
    })

    it('reverts given an expired signature', async () => {
      // Generate the response data
      const response = defaultAbiCoder.encode(
        ['bytes', 'uint64', 'bytes'],
        [resultData, Math.floor(Date.now() / 1000 - 1), signature],
      )

      // Call the function with the request and response
      await expect(resolver.resolveWithProof(response, callData)).to.be.reverted
    })
  })
})

function dnsName(name: string) {
  // strip leading and trailing '.'
  const n = name.replace(/^\.|\.$/gm, '')

  const bufLen = n === '' ? 1 : n.length + 2
  const buf = Buffer.allocUnsafe(bufLen)

  let offset = 0
  if (n.length) {
    const list = n.split('.')
    for (let i = 0; i < list.length; i++) {
      const len = buf.write(list[i], offset + 1)
      buf[offset] = len
      offset += len + 1
    }
  }
  buf[offset++] = 0
  return (
    '0x' + buf.reduce((output, elem) => output + ('0' + elem.toString(16)).slice(-2), '')
  )
}
