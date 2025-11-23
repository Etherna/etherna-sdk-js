import { etc } from "@noble/secp256k1"
import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import { normalize } from "viem/ens"

import type { EnsAddress, EthAddress } from "@/types/eth"

/**
 * Checks if the given address is a valid Ethereum address.
 *
 * @param address The address to check.
 * @returns A boolean indicating whether the address is a valid Ethereum address.
 */
export function isEthAddress(address: string): address is EthAddress {
  return /^0x[a-f0-9]{40}$/i.test(address)
}

/**
 * Checks if the given address is a valid ENS address.
 *
 * @param address The address to check.
 * @returns A boolean indicating whether the address is a valid ENS address.
 */
export function isEnsAddress(address: string): address is EnsAddress {
  return /^[a-z0-9_\-\.]+\.eth$/i.test(address)
}

/**
 * Converts the given bytes or hex string to an Ethereum account address.
 *
 * @param bytes The bytes or hex string to convert.
 * @returns The Ethereum account address.
 */
export function toEthAccount(bytes: Uint8Array | string): EthAddress {
  if (typeof bytes === "string") {
    return `0x${bytes.replace(/^0x/, "").toLowerCase()}`
  }
  return `0x${etc.bytesToHex(bytes)}`
}

/**
 * Fetches the Ethereum address associated with the given ENS address.
 *
 * @param ensAddress The ENS address to fetch the Ethereum address for.
 * @returns A Promise that resolves to the Ethereum address associated with the ENS address, or null if not found.
 */
export async function fetchAddressFromEns(ensAddress: EnsAddress): Promise<EthAddress | null> {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  })

  const address = await publicClient.getEnsAddress({
    name: normalize(ensAddress),
  })

  return address
}

/**
 * Fetches the ENS address associated with the given Ethereum address.
 *
 * @param address The Ethereum address to fetch the ENS address for.
 * @returns A Promise that resolves to the ENS address associated with the Ethereum address, or null if not found.
 */
export async function fetchEnsFromAddress(address: EthAddress): Promise<EnsAddress | null> {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  })

  const ens = (await publicClient.getEnsName({
    address,
  })) as EnsAddress | null

  return ens
}
