import type { EthernaSSOClient } from "."
import type { SSOIdentity } from ".."

export class IdentityClient {
  constructor(private instance: EthernaSSOClient) {}

  /**
   * Get current SSO user
   */
  async fetchCurrentIdentity() {
    const resp = await this.instance.request.get<SSOIdentity>(`/identity`, {
      ...this.instance.prepareAxiosConfig(),
    })

    if (typeof resp.data !== "object") {
      throw new Error("Cannot fetch identity")
    }

    return resp.data
  }
}
