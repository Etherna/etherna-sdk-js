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
  /** How to discover the API prefix when `apiPath` is not set. Defaults to Swagger. */
  apiDocType?: "swagger" | "scalar"
}

const scalarSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
})

const openApiForApiPathSchema = z.object({
  info: z.object({ version: z.string().optional() }).optional(),
  paths: z.record(z.string(), z.unknown()),
})

const API_PREFIX_RE = /^(\/api\/v\d+\.\d+)(?:\/|$)/
const API_PATH_VERSION_RE = /^\/api\/v(\d+\.\d+)/i

export class BaseClient {
  baseUrl: string
  request: AxiosInstance
  apiRequest: AxiosInstance
  accessToken?: string
  disableAccessTokenTimeout?: boolean
  private _apiPath?: string
  private accessTokenExpiresAt?: number
  private pendingResolvers: ((value: string) => void)[] = []
  private apiDocType: "swagger" | "scalar"

  /**
   * @param options Client options
   */
  constructor(baseUrl: string, options?: BaseClientOptions) {
    this.baseUrl = baseUrl
    this._apiPath = options?.apiPath
    this.apiDocType = options?.apiDocType ?? "swagger"
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

  async prepareAxiosConfig(opts?: RequestOptions): Promise<AxiosRequestConfig> {
    await this.awaitAccessToken()

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
    const bundleResponse = await this.request.get<string>(`${this.baseUrl}/swagger/index.js`, {
      responseType: "text",
    })
    const bundle = bundleResponse.data
    const configJsonText =
      bundle.match(/configObject *= *JSON\.parse\(\s*'([\s\S]*?)'\s*\)/m)?.[1] ?? "{}"

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
    } catch {
      return null
    }
  }

  /**
   * Load Scalar HTML (e.g. /scalar/) and read the embedded `sources` list (OpenAPI document URLs).
   */
  async fetchScalarSources() {
    const pageResponse = await this.request.get(`${this.baseUrl}/scalar/`, {
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    })
    const html = pageResponse.data as string
    const marker = '"sources":'
    const idx = html.indexOf(marker)
    if (idx === -1) {
      return null
    }
    const bracketStart = html.indexOf("[", idx + marker.length)
    if (bracketStart === -1) {
      return null
    }
    let depth = 0
    for (let i = bracketStart; i < html.length; i++) {
      const c = html[i]
      if (c === "[") {
        depth++
      } else if (c === "]") {
        depth--
        if (depth === 0) {
          try {
            const raw = html.slice(bracketStart, i + 1)
            return z.array(scalarSourceSchema).parse(JSON.parse(raw))
          } catch {
            return null
          }
        }
      }
    }
    return null
  }

  /**
   * Resolve `/api/vX.Y` from a served OpenAPI document (paths keys or `servers`).
   */
  async fetchApiPathFromOpenApiHref(openApiHref: string) {
    const res = await this.request.get(openApiHref, {
      responseType: "json",
      validateStatus: () => true,
    })
    if (res.status !== 200) {
      return null
    }
    const parsed = openApiForApiPathSchema.safeParse(res.data)
    if (!parsed.success) {
      return null
    }

    const keys = Object.keys(parsed.data.paths).sort()
    const fromPaths = keys.reduce<string | null>(
      (acc, path) => path.match(API_PREFIX_RE)?.[1] ?? acc,
      null,
    )

    if (fromPaths) {
      return fromPaths
    }

    const servers = (res.data as { servers?: { url?: string }[] }).servers
    const first = servers?.[0]?.url
    if (!first) {
      return null
    }
    try {
      const u = new URL(first, "http://placeholder.local")
      const m = u.pathname.match(API_PREFIX_RE)
      return m?.[1] ?? null
    } catch {
      return null
    }
  }

  async fetchApiPathFromScalar() {
    const fallbackApiPath = "/api/v0.1"
    const sources = (await this.fetchScalarSources()) ?? []
    const resolved: string[] = []
    for (const source of sources) {
      const openApiHref = composeUrl(this.baseUrl, source.url)
      const apiPath = await this.fetchApiPathFromOpenApiHref(openApiHref)
      if (apiPath) {
        resolved.push(apiPath)
      }
    }

    const apiPathVersionForSort = (apiPath: string): number => {
      const m = apiPath.match(API_PATH_VERSION_RE)
      return m ? parseFloat(m[1] ?? "0") : 0
    }

    return (
      resolved.sort((a, b) => apiPathVersionForSort(b) - apiPathVersionForSort(a))[0] ??
      fallbackApiPath
    )
  }

  /**
   * Resolve `/api/vX.Y` from Swagger UI config (`/swagger/index.js` urls list).
   */
  async fetchApiPathFromSwagger() {
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

  async fetchApiPath() {
    switch (this.apiDocType) {
      case "scalar":
        return this.fetchApiPathFromScalar()
      case "swagger":
        return this.fetchApiPathFromSwagger()
    }
  }

  autoLoadApiPath() {
    if (this.apiPath) {
      return
    }
    return this.fetchApiPath().then((apiPath) => {
      this.apiPath = apiPath
    })
  }

  /**
   * Wait for the access token to be usable
   * @returns The access token
   */
  awaitAccessToken() {
    if (
      !this.disableAccessTokenTimeout &&
      this.accessToken &&
      this.accessTokenExpiresAt &&
      this.accessTokenExpiresAt * 1000 <= Date.now()
    ) {
      return Promise.race([
        new Promise((resolve) => {
          this.pendingResolvers.push(resolve)
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new EthernaSdkError("TIMEOUT", "Access token not renewed within the timeout limit"),
            )
          }, 30_000)
        }),
      ])
    }

    return Promise.resolve(this.accessToken)
  }
}
