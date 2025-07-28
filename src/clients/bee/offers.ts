import { EthernaSdkError, throwSdkError } from "@/classes"

import type { BeeClient } from "."
import type { RequestOptions } from "@/types/clients"
import type { EthAddress } from "@/types/eth"
import type { Reference } from "@/types/swarm"

export class Offers {
  constructor(private instance: BeeClient) {}

  /**
   * Get all resource offers
   *
   * @param reference Hash of the resource
   * @param opts Request options
   * @returns Addresses of users that are offering the resource
   */
  async downloadOffers(reference: Reference, opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<EthAddress[]>(
            `/resources/${reference}/offers`,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )

          return resp.data
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Get current user's offered resources
   *
   * @returns Reference list of offered resources
   */
  async downloadOfferedResources(opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          const resp = await this.instance.apiRequest.get<Reference[]>(
            `/users/current/offeredResources`,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )

          return resp.data
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Check if a resource is offered
   *
   * @param reference Hash of the resource
   * @param opts Request options
   * @returns True if has offers
   */
  async isOffered(reference: Reference, opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.get<boolean>(
            `/resources/${reference}/isoffered`,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )

          return resp.data
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Check if multiple resources are offered
   *
   * @param references Hashes of the resources
   * @param opts Request options
   * @returns Addresses of users that are offering the resource
   */
  async batchAreOffered(references: Reference[], opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          const resp = await this.instance.apiRequest.post<Record<Reference, boolean>>(
            `/resources/areoffered`,
            references,
            {
              ...this.instance.prepareAxiosConfig(opts),
            },
          )

          return resp.data
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Offer a resource
   *
   * @param reference Hash of the resource
   * @param opts Request options
   * @returns True if successfull
   */
  async offer(reference: Reference, opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          await this.instance.apiRequest.post(`/resources/${reference}/offers`, undefined, {
            ...this.instance.prepareAxiosConfig(opts),
          })

          return true
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }

  /**
   * Cancel a resource offer
   *
   * @param reference Hash of the resource
   * @param opts Request options
   * @returns True if successfull
   */
  async cancelOffer(reference: Reference, opts?: RequestOptions) {
    try {
      switch (this.instance.type) {
        case "bee": {
          throw new EthernaSdkError(
            "NOT_IMPLEMENTED",
            "This operation is not supported by Bee client",
          )
        }
        case "etherna": {
          await this.instance.awaitAccessToken()

          await this.instance.apiRequest.delete(`/resources/${reference}/offers`, {
            ...this.instance.prepareAxiosConfig(opts),
          })
          return true
        }
      }
    } catch (error) {
      throwSdkError(error)
    }
  }
}
