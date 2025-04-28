import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import { normalize } from "viem/ens"

import type { EnsAddress, EthAddress } from "../clients"

export const isEthAddress = (address: string): address is EthAddress => {
  return /^0x[a-f0-9]{40}$/i.test(address)
}

export const isEnsAddress = (address: string): address is EnsAddress => {
  return /^[a-z0-9_\-\.]+\.eth$/i.test(address)
}

export const fetchAddressFromEns = async (ensAddress: EnsAddress): Promise<EthAddress | null> => {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  })

  const address = await publicClient.getEnsAddress({
    name: normalize(ensAddress),
  })

  return address
}

export const fetchEnsFromAddress = async (address: EthAddress): Promise<EnsAddress | null> => {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  })

  const ens = (await publicClient
    .getEnsName({
      address,
    })
    .catch(() => null)) as EnsAddress | null

  return ens
}
