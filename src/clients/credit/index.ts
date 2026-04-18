import { BaseClient } from "../base-client"
import { CreditPayments } from "./payments"
import { CreditUser } from "./user"

import type { BaseClientOptions } from "../base-client"

export interface CreditClientOptions extends BaseClientOptions {}

export class EthernaCreditClient extends BaseClient {
  user: CreditUser
  payments: CreditPayments

  /**
   * Init a credit client
   * @param options Client options
   */
  constructor(baseUrl: string, options?: CreditClientOptions) {
    super(baseUrl, { ...options, apiDocType: "scalar" })

    this.user = new CreditUser(this)
    this.payments = new CreditPayments(this)
  }
}
