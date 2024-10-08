import { beeReference } from "../../schemas/base"
import {
  VideoDetailsRawSchema,
  VideoPreviewRawSchema,
  VideoSourceSchema,
} from "../../schemas/video"
import { timestampToDate } from "../../utils"
import { getBzzUrl } from "../../utils/bzz"
import { ImageDeserializer } from "../image/deserializer"

import type { Reference } from "../../clients"
import type { VideoDetails, VideoPreview } from "../../schemas/video"

export type VideoDeserializerOptions = {
  /** Video swarm reference */
  reference: Reference
}

export class VideoDeserializer {
  constructor(private beeUrl: string) {}

  deserializePreview(data: string, opts: VideoDeserializerOptions): VideoPreview {
    const videoRaw = VideoPreviewRawSchema.parse(JSON.parse(data))

    const imageDeserializer = new ImageDeserializer(this.beeUrl)

    const video: VideoPreview = {
      reference: beeReference.parse(opts.reference),
      title: videoRaw.title,
      duration: videoRaw.duration,
      ownerAddress: videoRaw.ownerAddress,
      createdAt: timestampToDate(videoRaw.createdAt),
      updatedAt: videoRaw.updatedAt ? timestampToDate(videoRaw.updatedAt) : null,
      thumbnail: videoRaw.thumbnail
        ? imageDeserializer.deserialize(videoRaw.thumbnail, { reference: opts.reference })
        : null,
      v: videoRaw.v ?? "1.0",
    }

    return video
  }

  deserializeDetails(data: string, opts: VideoDeserializerOptions): VideoDetails {
    const videoRaw = VideoDetailsRawSchema.parse(JSON.parse(data))

    const video: VideoDetails = {
      description: videoRaw.description,
      aspectRatio: videoRaw.aspectRatio || null,
      personalData: videoRaw.personalData,
      sources: videoRaw.sources.map((source) =>
        VideoSourceSchema.parse({
          ...source,
          type: source.type || "mp4",
          url: getBzzUrl(
            this.beeUrl,
            "reference" in source && source.reference ? source.reference : opts.reference,
            source.path,
          ),
        }),
      ),
      captions: videoRaw.captions ?? [],
      batchId: videoRaw.batchId || null,
    }

    return video
  }
}
