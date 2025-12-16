import { EthernaSdkError, throwSdkError } from "@/classes"

import type { EthernaSSOClient } from "."

export class SSOAuth {
  constructor(private instance: EthernaSSOClient) {}

  /**
   * Get access token from api key
   */
  async signin(apiKey: string) {
    try {
      const [username, password] = apiKey.split(".")

      if (!username || !password) {
        throw new EthernaSdkError("INVALID_API_KEY", "Invalid api key")
      }

      const {
        data: { access_token: accessToken, ...rest },
      } = await this.instance.request.post<{
        access_token: string
        expires_in: number
        scope: string
      }>(
        "/connect/token",
        new URLSearchParams({
          grant_type: "password",
          scope:
            "profile ether_accounts openid userApi.gateway userApi.sso userApi.credit userApi.index",
          username,
          password,
        }),
        {
          headers: {
            Authorization: `Basic ${btoa("apiKeyClientId:")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      )

      const expiresAt = Date.now() / 1000 + rest.expires_in

      this.instance.updateAccessToken(accessToken, expiresAt)

      return { accessToken, expiresAt }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
