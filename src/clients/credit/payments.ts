import { throwSdkError } from "@/classes"

import type { CryptoWallet, PaymentCrypto } from "./types"
import type { EthernaCreditClient } from "."
import type { RequestOptions } from "@/types/clients"

export class CreditPayments {
  constructor(private instance: EthernaCreditClient) {}

  /**
   * List cryptocurrencies available for credit top-up.
   * Public endpoint (no access token).
   */
  async fetchAvailableCryptos(opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()

      const resp = await this.instance.apiRequest.get<PaymentCrypto[]>(
        `/payments/crypto/available`,
        opts,
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get or refresh the deposit wallet and invoice metadata for the current user.
   */
  async fetchDepositWallet(cryptoSymbol: string, opts?: RequestOptions) {
    try {
      await this.instance.autoLoadApiPath()
      await this.instance.awaitAccessToken()

      const resp = await this.instance.apiRequest.get<CryptoWallet>(
        `/payments/crypto/wallet/${encodeURIComponent(cryptoSymbol)}`,
        {
          ...(await this.instance.prepareAxiosConfig(opts)),
        },
      )

      return resp.data
    } catch (error) {
      throwSdkError(error)
    }
  }
}
