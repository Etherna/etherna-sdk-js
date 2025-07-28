import { EthAddress } from "@/types"

export interface CreditLog {
  amount: number
  author: string
  creationDateTime: string
  isApplied: boolean | null
  operationName: string
  reason: string | null
  userAddress: EthAddress
}

export interface CreditBalance {
  balance: number
  isUnlimited: boolean
}
