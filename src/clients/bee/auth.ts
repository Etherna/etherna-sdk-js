import { stringToBase64 } from "@/utils"

import type { BeeClient } from "."
import type { AuthenticationOptions } from "./types"

const authEndpoint = "/auth"
const authRefreshEndpoint = "/refresh"

export class Auth {
  private tokenExpiration: Date | null = null

  constructor(private instance: BeeClient) {}

  public get isAuthenticated(): boolean {
    const token = this.instance.accessToken
    const tokenExpiration = this.tokenExpiration?.getTime() ?? Date.now()

    return !!token && tokenExpiration > Date.now()
  }

  /**
   * Authenticate with the Bee node
   *
   * @param username Bee node admin username (by default empty)
   * @param password Bee node admin password
   */
  async authenticate(
    username: string,
    password: string,
    options?: AuthenticationOptions,
  ): Promise<string> {
    let token = this.instance.accessToken ?? null
    const expirationDate = this.tokenExpiration ?? new Date()

    if (token && expirationDate <= new Date()) {
      token = await this.refreshToken(token)
    }

    const expiration = options?.expiry || 3600 * 24 // 1 day

    if (!token) {
      const credentials = stringToBase64(`${username}:${password}`)

      const data = {
        role: options?.role ?? "maintainer",
        expiry: expiration,
      }

      const resp = await this.instance.request.post<{ key: string }>(`${authEndpoint}`, data, {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        timeout: options?.timeout,
        signal: options?.signal,
      })

      token = resp.data.key
      this.instance.accessToken = token
    }

    return token
  }

  async refreshToken(token: string, options?: AuthenticationOptions): Promise<string | null> {
    try {
      const expiration = options?.expiry || 3600 * 24 // 1 day

      const data = {
        role: options?.role ?? "maintainer",
        expiry: expiration,
      }

      const resp = await this.instance.request.post<{ key: string }>(
        `${authRefreshEndpoint}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: options?.timeout,
          signal: options?.signal,
        },
      )

      this.instance.accessToken = resp.data.key

      return resp.data.key
    } catch (error) {
      return null
    }
  }
}
