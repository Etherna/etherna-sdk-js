export interface RequestOptions {
  timeout?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}
