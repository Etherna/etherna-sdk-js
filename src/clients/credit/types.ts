import type { EthAddress } from "@/types"

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

export interface PaymentCrypto {
  displayName: string
  symbol: string
}

export interface CryptoTx {
  txId: string
  address: string
  amount: number
  crypto: string
  isConfirmed: boolean
}

export interface CryptoWallet {
  wallet: string
  coinDisplayName: string
  coinSymbol: string
  exchangeRate: number
  /** API returns a TimeSpan as a string (e.g. `"00:05:00"`) */
  recalculateAfter: string
  txs: CryptoTx[]
}

export type CallbackPaymentRequestFiat = "USD"

export type CallbackPaymentRequestStatus = "PARTIAL" | "PAID" | "OVERPAID"

export type CallbackPaymentRequestFeePolicy =
  | "NO_FEE"
  | "PERCENT_FEE"
  | "FIXED_FEE"
  | "PERCENT_OR_MINIMAL_FIXED_FEE"

export interface CallbackTransactionInput {
  txid: string
  date: string
  amount_crypto: string
  amount_fiat: string
  amount_fiat_without_fee: string
  fee_fiat: string
  trigger: boolean
  crypto: string
}

export interface CallbackPaymentRequestInput {
  external_id: string
  crypto: string
  addr: string
  fiat: CallbackPaymentRequestFiat
  balance_fiat: string
  balance_crypto: string
  paid: boolean
  status: CallbackPaymentRequestStatus
  overpaid_fiat: string
  fee_percent: string
  fee_fixed: string
  fee_policy: CallbackPaymentRequestFeePolicy
  transactions: CallbackTransactionInput[]
}
