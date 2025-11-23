import type { EthAddress } from "@/types/eth"

export interface SSOIdentity {
  accountType: "web2" | "web3"
  email: string | null
  etherAddress: EthAddress
  etherManagedPrivateKey: string | null
  etherPreviousAddresses: string[]
  etherLoginAddress: string | null
  phoneNumber: string | null
  username: string
}
