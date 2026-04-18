import type { PaginatedResult } from "../index/types"
import type { RequestOptions } from "@/types/clients"

export interface IndexAggregatorRequestOptions extends RequestOptions {
  indexUrl?: string
}

export interface AggregatedPaginatedResult<T> extends PaginatedResult<T> {
  shouldContinue: boolean
}
