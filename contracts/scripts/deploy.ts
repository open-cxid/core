import '@nomiclabs/hardhat-ethers'
import { ethers } from 'hardhat'

async function deployOffchainResolver() {
  const factory = await ethers.getContractFactory('OffchainResolver')
  const url = process.env.GATEWAY_URL!
  const signers = process.env.GATEWAY_SIGNER_ADDRESSES!.split(',')

  const s = await ethers.getSigners()
  console.log('Deployer:', s[0].address)
  // If we had constructor arguments, they would be passed into deploy()
  const contract = await factory.deploy(url, signers)
  console.log('OffchainResolver:', contract.address)
  console.log('OffchainResolver deployment tx hash:', contract.deployTransaction.hash)

  // The contract is NOT deployed yet; we must wait until it is mined
  await contract.deployed()
}

async function main() {
  await deployOffchainResolver()
}

main().catch((error) => {
  console.error(error)
  throw error
})
