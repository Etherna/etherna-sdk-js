import { AxiosError } from "axios"
import { ZodError } from "zod"

export const ErrorCodes = [
  "NOT_FOUND",
  "SERVER_ERROR",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "PERMISSION_DENIED",
  "MISSING_FUNDS",
  "MISSING_BATCH_ID",
  "MISSING_REFERENCE",
  "MISSING_SIGNER",
  "MISSING_WALLET",
  "OUTDATED_WALLET",
  "LOCKED_WALLET",
  "BUCKET_FILLED",
  "ABORTED_BY_USER",
  "INVALID_ARGUMENT",
  "INVALID_API_KEY",
  "NOT_IMPLEMENTED",
  "UNSUPPORTED_OPERATION",
  "TIMEOUT",
  "VALIDATION_ERROR",
  "ENCODING_ERROR",
  "ENCRYPTION_ERROR",
  "DECRYPTION_ERROR",
] as const

export type ErrorCode = (typeof ErrorCodes)[number]

export class EthernaSdkError extends Error {
  code: ErrorCode
  error?: Error
  axiosError?: AxiosError
  zodError?: ZodError

  constructor(code: ErrorCode, message: string, error?: Error | AxiosError | ZodError) {
    super(message)
    this.name = "EthernaSdkError"
    this.code = code
    this.stack = error?.stack ?? this.stack

    if (error instanceof AxiosError) {
      this.axiosError = error
    } else if (error instanceof ZodError) {
      this.zodError = error
    } else if (error instanceof Error) {
      this.error = error
    }
  }
}

export function getSdkError(err: unknown): EthernaSdkError {
  if (err instanceof EthernaSdkError) {
    return err
  }

  if (err instanceof AxiosError) {
    const code = err.response?.status ?? 500
    switch (code) {
      case 400:
        return new EthernaSdkError("BAD_REQUEST", err.message, err)
      case 401:
        return new EthernaSdkError("UNAUTHORIZED", err.message, err)
      case 402:
        return new EthernaSdkError("MISSING_FUNDS", err.message, err)
      case 403:
        return new EthernaSdkError("PERMISSION_DENIED", err.message, err)
      case 404:
        return new EthernaSdkError("NOT_FOUND", err.message, err)
      default:
        return new EthernaSdkError(code ? "SERVER_ERROR" : "BAD_REQUEST", err.message, err)
    }
  }

  if (err instanceof ZodError) {
    let message = err.issues[0]?.message ?? "Validation error"
    if (err.issues.length > 1) {
      message += ` (+${err.issues.length - 1} others)`
    }

    return new EthernaSdkError("VALIDATION_ERROR", message, err)
  }

  if (err instanceof Error) {
    return new EthernaSdkError("SERVER_ERROR", err.message, err)
  }

  return new EthernaSdkError("SERVER_ERROR", String(err))
}

export function throwSdkError(err: unknown): never {
  throw getSdkError(err)
}
