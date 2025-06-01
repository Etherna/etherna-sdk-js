import { makeChunkedFile } from "@fairdatasociety/bmt-js"
import { toBlobURL } from "@ffmpeg/util"

import { BaseProcessor } from "./base-processor"
import { ImageProcessor } from "./image-processor"
import { EthernaSdkError } from "@/classes"
import { bytesReferenceToReference, fileToBuffer, getHlsBitrate } from "@/utils"

import type { ProcessorOutput } from "./base-processor"
import type { VideoSource } from "@/schemas/video-schema"
import type { FFmpeg } from "@ffmpeg/ffmpeg"

export interface VideoProcessorOptions {
  resolutions?: number[]
  /**
   * - Default: `https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm`
   */
  ffmpegBaseUrl?: string
  /**
   * - Default: `"sources/hls"`
   */
  basePath?: string
  signal?: AbortSignal
}

export interface VideoProcessedOutput {
  duration: number
  aspectRatio: number
  sources: VideoSource[]
}

let ffmpeg: FFmpeg
const BASE_URL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm"
const DEFAULT_RESOLUTIONS = [360, 480, 720, 1080, 1440]
const INPUT_FILENAME = "input"
const BASE_PATH = "sources/hls"

const handleFFmpegPromise = (exec: Promise<number>) => {
  return exec
    .then((code) => {
      if (code === 1) {
        throw new EthernaSdkError("TIMEOUT", "Video conversion timeout")
      }
      if (code > 0) {
        throw new EthernaSdkError("ENCODING_ERROR", "Video conversion failed")
      }
    })
    .catch((error) => {
      throw new EthernaSdkError("ENCODING_ERROR", "Video conversion failed", error as Error)
    })
}

export class VideoProcessor extends BaseProcessor {
  private _video: VideoProcessedOutput | null = null

  public get video() {
    return this._video
  }

  public override async process(options: VideoProcessorOptions): Promise<ProcessorOutput[]> {
    await this.loadFFmpeg(options.ffmpegBaseUrl ?? BASE_URL)

    await ffmpeg.writeFile(
      INPUT_FILENAME,
      new Uint8Array(
        this.input instanceof File || this.input instanceof Blob
          ? await fileToBuffer(this.input)
          : this.input,
      ),
      { signal: options.signal },
    )

    const { width, height, duration } = await this.getVideoMeta()
    const aspectRatio = width / height
    const resolutions = (options.resolutions ?? DEFAULT_RESOLUTIONS)
      .filter((r) => r <= height)
      .map((height) => {
        let scaledWidth = Math.round(height * aspectRatio)
        switch (scaledWidth % 4) {
          case 1:
            scaledWidth--
            break
          case 2:
            scaledWidth += 2
            break
          case 3:
            scaledWidth++
            break
        }
        return { height, width: scaledWidth }
      })

    await ffmpeg.deleteDir("hls") // clear previous run
    await ffmpeg.createDir("hls")

    const basePath = options.basePath ?? BASE_PATH

    await handleFFmpegPromise(
      ffmpeg.exec([
        // input
        "-y",
        "-hide_banner",
        "-i",
        INPUT_FILENAME,
        // hls encoding
        ...resolutions.flatMap(() => ["-map", "0:v:0", "-map", "0:a:0"]),
        ...resolutions.flatMap(({ width, height }, i) => [
          `-s:v:${i} ${width}x${height}`,
          `-b:v:${i} ${getHlsBitrate(width, height)}k`,
        ]),
        "-preset",
        "fast",
        "-c:a",
        "aac",
        "-c:v",
        "libx264",
        "-f",
        "hls",
        "-hls_time",
        "6",
        "-hls_list_size",
        "0",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        `"${basePath}/%v/%d.ts"`,
        "-var_stream_map",
        `"${resolutions.map(({ height }, i) => `v:${i},a:${i},name:${height}p`).join(" ")}"`,
        "-master_pl_name",
        "master.m3u8",
        `${basePath}/%v/playlist.m3u8`,
      ]),
    )

    const masterFile = {
      path: `${basePath}/master.m3u8`,
      data: (await ffmpeg.readFile(`${basePath}/master.m3u8`)) as Uint8Array,
    }
    const resolutionsPlaylists = await Promise.all(
      resolutions.map(async (res) => ({
        path: `${basePath}/${res}/playlist.m3u8`,
        data: (await ffmpeg.readFile(`${basePath}/${res}/playlist.m3u8`)) as Uint8Array,
      })),
    )
    const resolutionsSegments = await Promise.all(
      resolutions.map(async (res) => {
        const resDirContent = (await ffmpeg.listDir(`${basePath}/${res}`)).filter(
          (f) => !f.isDir && f.name.endsWith(".ts"),
        )
        return await Promise.all(
          resDirContent.map(async (file) => {
            const data = (await ffmpeg.readFile(`${basePath}/${res}/${file.name}`)) as Uint8Array
            return { path: `${basePath}/${res}/${file.name}`, data }
          }),
        )
      }),
    )

    this._video = {
      aspectRatio,
      duration,
      sources: [
        {
          type: "hls",
          path: `${basePath}/master.m3u8`,
          size: 0,
        },
        ...resolutions.map((res, i) => ({
          type: "hls" as const,
          path: `${basePath}/${res}/playlist.m3u8`,
          size: resolutionsSegments[i]?.reduce((acc, { data }) => acc + data.byteLength, 0) ?? 0,
        })),
      ],
    }

    this._processorOutputs = []

    for (const file of [masterFile, ...resolutionsPlaylists, ...resolutionsSegments.flat()]) {
      const chunkedFile = makeChunkedFile(file.data)

      // append to uploader queue
      this.uploader?.append(chunkedFile)

      // add chunks collisions
      chunkedFile
        .bmt()
        .flat()
        .forEach((chunk) => this.stampCalculator.add(bytesReferenceToReference(chunk.address())))

      // add to output
      this.processorOutputs.push({
        path: file.path,
        entryAddress: bytesReferenceToReference(chunkedFile.address()),
        metadata: {
          filename: file.path.split("/").pop() as string,
          contentType: (() => {
            const ext = file.path.split(".").pop() as string
            switch (ext) {
              case "m3u8":
                return "application/vnd.apple.mpegurl"
              case "ts":
                return "video/MP2T"
              default:
                return "application/octet-stream"
            }
          })(),
        },
      })
    }

    this._isProcessed = true

    return this.processorOutputs
  }

  public async createThumbnailProcessor(frameTimestamp: number) {
    if (!this._video) {
      throw new EthernaSdkError("SERVER_ERROR", "Video not processed")
    }

    const aspectRatio = this._video.aspectRatio
    const imageData = await this.generateThumbnail(frameTimestamp, aspectRatio)

    return new ImageProcessor(imageData)
  }

  private async getVideoMeta() {
    return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
      let width: number
      let height: number
      let duration: number

      ffmpeg.on("log", (event) => {
        const message = event.message
        // check resolution
        const parsedSize = message.match(/\d{3,}x\d{3,}/)?.[0]
        if (parsedSize) {
          const [w, h] = parsedSize.split("x").map(Number) as [number, number]
          height = h
          width = w
        }
        // check duration
        const parsedDuration = message.match(/Duration: (\d{2}:\d{2}:\d{2})/)?.[1]
        if (parsedDuration) {
          const [h, m, s] = parsedDuration.split(":").map(Number) as [number, number, number]
          duration = h * 3600 + m * 60 + s
        }
        // check failed conversion
        if (message.includes("Conversion failed!")) {
          reject(new EthernaSdkError("ENCODING_ERROR", "Video conversion failed"))
        }
      })

      handleFFmpegPromise(
        ffmpeg.exec([`-i`, `${INPUT_FILENAME}`, `-hide_banner`, `-f`, `null`]),
      ).then(() => {
        if (width && height && duration) {
          resolve({ width, height, duration })
        } else {
          reject(new EthernaSdkError("ENCODING_ERROR", "Video conversion failed"))
        }
      })
    })
  }

  private async generateThumbnail(frameTimestamp: number, aspectRatio: number) {
    const thumbFrame = (() => {
      const hours = String(Math.floor(frameTimestamp / 3600))
      const minutes = String(Math.floor((frameTimestamp % 3600) / 60))
      const seconds = String(frameTimestamp % 60)
      return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`
    })()

    await handleFFmpegPromise(
      ffmpeg.exec([
        "-y",
        "-hide_banner",
        "-i",
        INPUT_FILENAME,
        "-ss",
        thumbFrame,
        "-vframes",
        "1",
        "-vf",
        `scale=${Math.round(720 * aspectRatio)}:720`,
        "-q:v",
        "5",
        "thumb.jpg",
      ]),
    )

    const thumbData = (await ffmpeg.readFile("thumb.jpg")) as Uint8Array

    return thumbData
  }

  private async loadFFmpeg(baseUrl: string) {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg")

    if (ffmpeg?.loaded) {
      ffmpeg.terminate()
    }

    ffmpeg = new FFmpeg()

    const isCors =
      typeof window !== "undefined" && window.location.origin !== new URL(baseUrl).origin

    await ffmpeg.load({
      coreURL: isCors
        ? await toBlobURL(`${baseUrl}/ffmpeg-core.js`, "text/javascript")
        : `${baseUrl}/ffmpeg-core.js`,
      wasmURL: isCors
        ? await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, "application/wasm")
        : `${baseUrl}/ffmpeg-core.wasm`,
      workerURL: isCors
        ? await toBlobURL(`${baseUrl}/ffmpeg-core.worker.js`, "text/javascript")
        : `${baseUrl}/ffmpeg-core.worker.js`,
    })

    return ffmpeg
  }
}
