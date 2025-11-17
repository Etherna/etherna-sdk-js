import axios from "axios"
import z from "zod"

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
  request: AxiosInstance
  apiRequest: AxiosInstance
  accessToken?: string
  disableAccessTokenTimeout?: boolean
  private _apiPath?: string
  private accessTokenExpiresAt?: number
  private pendingResolvers: ((value: string) => void)[] = []

  /**
   * @param options Client options
   */
  constructor(baseUrl: string, options?: BaseClientOptions) {
    this.baseUrl = baseUrl
    this._apiPath = options?.apiPath
    this.request = axios.create({ baseURL: this.baseUrl })
    this.apiRequest = axios.create({ baseURL: this.apiUrl })
    this.accessToken = options?.accessToken
    this.accessTokenExpiresAt = options?.accessTokenExpiresAt
    this.disableAccessTokenTimeout = options?.disableAccessTokenTimeout ?? false
  }

  public get apiPath(): string | undefined {
    return this._apiPath
  }
  public set apiPath(apiPath: string | undefined) {
    this._apiPath = apiPath
    this.apiRequest = axios.create({ baseURL: this.apiUrl })
  }

  public get apiUrl(): string {
    return composeUrl(this.baseUrl, this.apiPath)
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

  async fetchSwaggerUrls() {
    const bundleResponse = await this.request.get(`${this.baseUrl}/swagger/index.js`, {
      responseType: "text",
    })
    const bundle = bundleResponse.data
    const configJsonText = bundle.match(/configObject *\= *JSON\.parse\(\s*'([\s\S]*?)'\s*\)/m)?.[1]

    try {
      const configJson = z
        .object({
          urls: z.array(
            z.object({
              url: z.string(), // eg: /swagger/v0.3/swagger.json
              name: z.string(), // eg: V0.3
            }),
          ),
        })
        .parse(JSON.parse(configJsonText))

      return configJson.urls
    } catch (error) {
      return null
    }
  }

  async fetchApiPath() {
    const versionMatch = /v(\d+\.\d+)/i
    const urls = await this.fetchSwaggerUrls()
    const mainVersion = urls
      ?.filter((url) => versionMatch.test(url.name))
      .sort((a, b) => {
        const aVersion = parseFloat(a.name.match(versionMatch)?.[1] || "0.0")
        const bVersion = parseFloat(b.name.match(versionMatch)?.[1] || "0.0")
        return bVersion - aVersion
      })?.[0]

    return `/api/v${mainVersion?.name.match(versionMatch)?.[1] || "0.1"}`
  }

  autoLoadApiPath() {
    if (this.apiPath) {
      return
    }
    return this.fetchApiPath().then((apiPath) => {
      this.apiPath = apiPath
    })
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
