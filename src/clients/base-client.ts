import axios from "axios"

import { EthernaSdkError } from "@/classes"
import { composeUrl } from "@/utils"

import type { RequestOptions } from "@/types/clients"
import type { AxiosInstance, AxiosRequestConfig } from "axios"

export interface BaseClientOptions {
  apiPath?: string
  accessToken?: string
  accessTokenExpiresAt?: number
  disableAccessTokenTimeout?: boolean
}

export class BaseClient {
  baseUrl: string
  apiUrl: string
  request: AxiosInstance
  apiRequest: AxiosInstance
  accessToken?: string
  disableAccessTokenTimeout?: boolean
  private accessTokenExpiresAt?: number
  private pendingResolvers: ((value: string) => void)[] = []

  /**
   * @param options Client options
   */
  constructor(baseUrl: string, options?: BaseClientOptions) {
    this.baseUrl = baseUrl
    this.apiUrl = composeUrl(baseUrl, options?.apiPath)
    this.request = axios.create({ baseURL: this.baseUrl })
    this.apiRequest = axios.create({ baseURL: this.apiUrl })
    this.accessToken = options?.accessToken
    this.accessTokenExpiresAt = options?.accessTokenExpiresAt
    this.disableAccessTokenTimeout = options?.disableAccessTokenTimeout ?? false
  }

  updateAccessToken(accessToken: string | undefined, expiresAt?: number) {
    this.accessToken = accessToken
    this.accessTokenExpiresAt = expiresAt

    if (accessToken) {
      this.pendingResolvers.forEach((resolve) => resolve(accessToken))
      this.pendingResolvers = []
    }
  }

  prepareAxiosConfig(opts?: RequestOptions): AxiosRequestConfig {
    const authHeader = this.accessToken
      ? {
          Authorization: `Bearer ${this.accessToken}`,
        }
      : {}
    return {
      headers: {
        ...authHeader,
        ...opts?.headers,
      },
      signal: opts?.signal,
      timeout: opts?.timeout,
    }
  }

  prepareFetchConfig(opts?: RequestOptions): RequestInit {
    const headers: HeadersInit = {
      ...opts?.headers,
    }

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`
    }

    const timeoutAbortController = new AbortController()
    if (opts?.timeout) {
      setTimeout(() => timeoutAbortController.abort(), opts.timeout)
    }

    return {
      headers,
      signal: opts?.signal ?? timeoutAbortController.signal,
    }
  }

  awaitAccessToken() {
    if (this.disableAccessTokenTimeout) {
      return Promise.resolve(this.accessToken)
    }

    if (this.accessToken && !this.accessTokenExpiresAt) {
      throw new EthernaSdkError("JWT_MISSING_OR_EXPIRED", "Access token is missing or expired")
    }

    if (
      this.accessToken &&
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt * 1000 < Date.now()
    ) {
      throw new EthernaSdkError("JWT_MISSING_OR_EXPIRED", "Access token is missing or expired")
    }

    if (this.accessToken) {
      return Promise.resolve(this.accessToken)
    }

    return Promise.race([
      new Promise((resolve) => {
        this.pendingResolvers.push(resolve)
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new EthernaSdkError("TIMEOUT", "Access token not received within the timeout limit"),
          )
        }, 30_000)
      }),
    ])
  }
}
