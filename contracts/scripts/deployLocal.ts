/* eslint-disable @typescript-eslint/no-unsafe-call */
import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'
import { Contract, Wallet } from 'ethers'

async function deploy(contractName: string, args: any[]) {
  const factory = await ethers.getContractFactory(contractName)
  const contract = await factory.deploy(...args)
  console.log(`${contractName}:`, contract.address)
  console.log(`${contractName} deployment tx hash:`, contract.deployTransaction.hash)
  await contract.deployed()
  return contract
}

async function deployENSRegistry() {
  return await deploy('ENSRegistry', [])
}

async function deployOffchainResolver() {
  const url = process.env.GATEWAY_URL!
  const gatewaySigner = Wallet.createRandom()
  console.log('gateway signer private key:', gatewaySigner.privateKey)
  console.log('gateway signer address:', gatewaySigner.address)
  const signers = [gatewaySigner.address]

  // If we had constructor arguments, they would be passed into deploy()
  return await deploy('OffchainResolver', [url, signers])
}

async function setTestResolver(registry: Contract, resolver: Contract) {
  const signers = await ethers.getSigners()
  const owner = signers[0].address
  await registry.setSubnodeOwner(
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    ethers.utils.id('io'),
    owner,
    { from: owner },
  )
  await registry.setSubnodeOwner(
    ethers.utils.namehash('io'),
    ethers.utils.id('cxid'),
    owner,
    { from: owner },
  )
  await registry.setResolver(ethers.utils.namehash('cxid.io'), resolver.address, {
    from: owner,
  })
}

async function main() {
  const registry = await deployENSRegistry()
  const resolver = await deployOffchainResolver()
  await setTestResolver(registry, resolver)
}

main().catch((error) => {
  console.error(error)
  throw error
})
