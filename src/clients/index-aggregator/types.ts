import { PaginatedResult } from "../index/types"
import { RequestOptions } from "@/types/clients"

export interface IndexAggregatorRequestOptions extends RequestOptions {
  indexUrl?: string
}

export type AggregatedPaginatedResult<T> = PaginatedResult<T> & {
  shouldContinue: boolean
}
