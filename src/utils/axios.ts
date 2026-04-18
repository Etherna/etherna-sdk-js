import { AxiosHeaders } from "axios"

import type { AxiosHeaderValue, AxiosRequestConfig } from "axios"

/**
 * Converts axios request headers to a plain object so they can be spread into `{ headers: { ... } }`.
 * {@link AxiosHeaders} implements `Symbol.iterator`; spreading it in an object literal is unsafe and
 * triggers `typescript-eslint(no-misused-spread)`.
 */
export function axiosHeadersToPlainObject(
  headers: AxiosRequestConfig["headers"],
): Record<string, AxiosHeaderValue> {
  if (!headers) {
    return {}
  }
  return AxiosHeaders.from(headers as ConstructorParameters<typeof AxiosHeaders>[0]).toJSON()
}
