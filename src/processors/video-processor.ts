import { makeChunkedFile } from "@fairdatasociety/bmt-js"

import { BaseProcessor } from "./base-processor"
import { ImageProcessor } from "./image-processor"
import { EthernaSdkError } from "@/classes"
import { bytesReferenceToReference, fileToBuffer, getHlsBitrate } from "@/utils"
import { loadNodeFFmpeg } from "@/utils/ffmpeg"

import type { ProcessorOutput } from "./base-processor"
import type { VideoSource } from "@/schemas/video-schema"
import type { FFmpeg } from "@ffmpeg/ffmpeg"

export interface VideoProcessorOutputOptions {
  ffmpeg: FFmpeg
  /**
   * - Default: `"sources/hls"`
   */
  basePath?: string
}

export interface VideoProcessorOptions extends VideoProcessorOutputOptions {
  resolutions?: number[]
  signal?: AbortSignal
  progressCallback?: (progress: number) => void
}

export interface VideoProcessedOutput {
  duration: number
  aspectRatio: number
  sources: VideoSource[]
}

let ffmpeg: FFmpeg
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
        throw new EthernaSdkError("ENCODING_ERROR", `Video conversion failed. Error code: ${code}`)
      }
    })
    .catch((error) => {
      throw new EthernaSdkError("ENCODING_ERROR", "Video conversion failed", error as Error)
    })
}

export class VideoProcessor extends BaseProcessor {
  private _video: VideoProcessedOutput | null = null
  private _cachedMetadata: { width: number; height: number; duration: number } | null = null

  public get video() {
    return this._video
  }

  public override async process(options: VideoProcessorOptions): Promise<ProcessorOutput[]> {
    ffmpeg = options.ffmpeg

    ffmpeg.on("progress", ({ progress }) => {
      options.progressCallback?.(progress * 100)
    })

    ffmpeg.on("log", (event) => {
      console.debug(event.message)
    })

    await this.writeInputFileIfNeeded()

    const { width, height } = await this.getVideoMeta()
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

    const ffmpegDir = "hls"

    await ffmpeg.deleteDir(ffmpegDir).catch(() => {}) // clear previous run
    await ffmpeg.createDir(ffmpegDir)

    await handleFFmpegPromise(
      ffmpeg.exec(
        [
          // input
          "-y",
          "-hide_banner",
          "-i",
          INPUT_FILENAME,
          // hls encoding
          ...resolutions.flatMap(() => ["-map", "0:v:0", "-map", "0:a:0"]),
          ...resolutions.flatMap(({ width, height }, i) => [
            `-s:v:${i}`,
            `${width}x${height}`,
            `-b:v:${i}`,
            `${getHlsBitrate(width, height)}k`,
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
          `"${ffmpegDir}/%v/%d.ts"`,
          "-var_stream_map",
          `${resolutions.map(({ height }, i) => `v:${i},a:${i},name:${height}p`).join(" ")}`,
          "-master_pl_name",
          "master.m3u8",
          `${ffmpegDir}/%v/playlist.m3u8`,
        ],
        undefined,
        { signal: options.signal },
      ),
    )

    await this.processOutput({
      basePath: ffmpegDir,
      loadFileDataFn: (path) =>
        ffmpeg.readFile(`${ffmpegDir}/${path}`).then((f) => f as Uint8Array),
      listDirFoldersFn: (path) =>
        ffmpeg
          .listDir(`${ffmpegDir}/${path}`)
          .then((dir) => dir.filter((f) => f.isDir).map((f) => f.name)),
      listDirFilesFn: (path) =>
        ffmpeg
          .listDir(`${ffmpegDir}/${path}`)
          .then((dir) => dir.filter((f) => !f.isDir).map((f) => f.name)),
    })

    this._isProcessed = true

    return this.processorOutputs
  }

  public async loadFromDirectory(
    directory: FileSystemDirectoryHandle | string,
    opts?: VideoProcessorOutputOptions,
  ) {
    if (opts?.ffmpeg) {
      ffmpeg = opts.ffmpeg
    }

    if (typeof directory === "string" && typeof window !== "undefined") {
      throw new EthernaSdkError("INVALID_ARGUMENT", "'string' directory is for nodejs environment'")
    }

    if (typeof window !== "undefined" && typeof directory !== "string") {
      const getLastDir = async (path: string) => {
        const dirs = path.split("/").slice(0, -1)
        let lastDirHandle = directory
        for (const dir of dirs) {
          lastDirHandle = await lastDirHandle.getDirectoryHandle(dir)
        }
        return lastDirHandle
      }

      await this.processOutput({
        basePath: opts?.basePath,
        loadFileDataFn: (path) =>
          getLastDir(path)
            .then((dir) => dir.getFileHandle(path.split("/").pop() as string))
            .then((f) => f.getFile())
            .then((f) => f.arrayBuffer())
            .then((b) => new Uint8Array(b)),
        listDirFoldersFn: (path) =>
          getLastDir(path)
            .then((dir) => (path ? dir.getDirectoryHandle(path.split("/").pop() as string) : dir))
            .then((dir) => dir.entries())
            .then((entries) => Array.fromAsync(entries))
            .then((entries) =>
              entries.filter(([_, h]) => h.kind === "directory").map(([name]) => name),
            ),
        listDirFilesFn: (path) =>
          getLastDir(path)
            .then((dir) => (path ? dir.getDirectoryHandle(path.split("/").pop() as string) : dir))
            .then((dir) => dir.entries())
            .then((entries) => Array.fromAsync(entries))
            .then((entries) => entries.filter(([_, h]) => h.kind === "file").map(([name]) => name)),
      })
    } else if (typeof window === "undefined" && typeof directory === "string") {
      const fs = await import("fs/promises")
      await this.processOutput({
        basePath: opts?.basePath,
        loadFileDataFn: (path) => fs.readFile(`${directory}/${path}`),
        listDirFoldersFn: (path) =>
          fs
            .readdir(`${directory}/${path}`, { withFileTypes: true })
            .then((files) => files.filter((f) => f.isDirectory()).map((f) => f.name)),
        listDirFilesFn: (path) =>
          fs
            .readdir(`${directory}/${path}`, { withFileTypes: true })
            .then((files) => files.filter((f) => f.isFile()).map((f) => f.name)),
      })
    }

    this._isProcessed = true
  }

  public async createThumbnailProcessor(
    frameTimestamp: number,
    opts?: VideoProcessorOutputOptions,
  ) {
    if (opts?.ffmpeg) {
      ffmpeg = opts.ffmpeg
    }

    const imageData = await this.generateThumbnail(frameTimestamp)

    return new ImageProcessor(imageData)
  }

  private async processOutput(
    options: Omit<VideoProcessorOutputOptions, "ffmpeg"> & {
      loadFileDataFn: (path: string) => Promise<Uint8Array>
      listDirFoldersFn: (path: string) => Promise<string[]>
      listDirFilesFn: (path: string) => Promise<string[]>
    },
  ) {
    super.process()

    const { width, height, duration } = await this.getVideoMeta()
    const aspectRatio = width / height

    const basePath = options.basePath ?? BASE_PATH
    const resolutions = (await options.listDirFoldersFn("")).filter((f) => /^\d{3,}p$/.test(f))

    const masterFile = {
      path: `${basePath}/master.m3u8`,
      data: await options.loadFileDataFn(`master.m3u8`),
    }
    const resolutionsPlaylists = await Promise.all(
      resolutions.map(async (res) => ({
        path: `${basePath}/${res}/playlist.m3u8`,
        data: await options.loadFileDataFn(`${res}/playlist.m3u8`),
      })),
    )
    const resolutionsSegments = await Promise.all(
      resolutions.flatMap(async (res) => {
        const resDirContent = (await options.listDirFilesFn(`${res}`)).filter((f) =>
          f.endsWith(".ts"),
        )
        return await Promise.all(
          resDirContent.map(async (file) => {
            const data = await options.loadFileDataFn(`${res}/${file}`)
            return { path: `${basePath}/${res}/${file}`, data }
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

      // append chunked file
      this.appendChunkedFile(chunkedFile)

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
  }

  private async getVideoMeta() {
    if (this._cachedMetadata) {
      return this._cachedMetadata
    }

    if (typeof window !== "undefined") {
      return this.getBrowserVideoMeta()
    } else {
      return this.getNodeVideoMeta()
    }
  }

  private async getBrowserVideoMeta() {
    return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
      let width: number
      let height: number
      let duration: number

      ffmpeg.on("log", (event) => {
        try {
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
            reject(new EthernaSdkError("ENCODING_ERROR", "Metadata loading failed"))
          }
        } catch (error) {
          console.error("FFPROBE ERROR", error)
        }
      })

      this.writeInputFileIfNeeded()
        .then(() => {
          handleFFmpegPromise(ffmpeg.ffprobe([`${INPUT_FILENAME}`, `-hide_banner`]))
            .then(() => {
              if (width && height && duration) {
                this._cachedMetadata = { width, height, duration }
                resolve({ width, height, duration })
              } else {
                throw new EthernaSdkError("ENCODING_ERROR", "Failed to load video metadata")
              }
            })
            .catch(() => {
              reject(new EthernaSdkError("ENCODING_ERROR", "Failed to load video metadata"))
            })
        })
        .catch(() => {
          reject(new EthernaSdkError("ENCODING_ERROR", "Failed to save input file"))
        })
    })
  }

  private async getFFmpeg() {
    return await loadNodeFFmpeg(this.input, INPUT_FILENAME)
  }

  private async getNodeVideoMeta() {
    const ffmpeg = await this.getFFmpeg()

    return new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
      let height = 0
      let width = 0
      let duration = 0

      ffmpeg.setLogger((_, message) => {
        if (!message || typeof message !== "string") return
        // check resolution
        const parsedSize = message.match(/\d{3,}x\d{3,}/)?.[0]

        if (parsedSize) {
          const [w, h] = parsedSize.split("x").map(Number)
          if (w && h && !isNaN(w) && !isNaN(h)) {
            height = h
            width = w
          }
        }
        // check duration
        const parsedDuration = message.match(/Duration: (\d{2}:\d{2}:\d{2})/)?.[1]

        if (parsedDuration) {
          const [h, m, s] = parsedDuration.split(":").map(Number)
          if (h != null && m != null && s != null && !isNaN(h) && !isNaN(m) && !isNaN(s)) {
            duration = h * 3600 + m * 60 + s
          }
        }
        // check failed conversion
        if (message.includes("Conversion failed!")) {
          reject(new Error("Failed to convert video"))
        }
      })

      ffmpeg.setLogging(true)

      ffmpeg
        .run(`-i`, `${INPUT_FILENAME}`, `-f`, `null`)
        .then(() => {
          if (height && width && duration) {
            this._cachedMetadata = { width, height, duration }
            resolve({ width, height, duration })
          } else {
            reject(new EthernaSdkError("ENCODING_ERROR", "Failed to load video metadata"))
          }
        })
        .catch(reject)
    })
  }

  private async writeInputFileIfNeeded() {
    if (!this.input) {
      throw new EthernaSdkError("ENCODING_ERROR", "Input file not found")
    }

    const dirContent = await ffmpeg.listDir(".")

    if (!dirContent.some((f) => f.name === INPUT_FILENAME)) {
      await ffmpeg.writeFile(
        INPUT_FILENAME,
        new Uint8Array(
          this.input instanceof File || this.input instanceof Blob
            ? await fileToBuffer(this.input)
            : this.input,
        ),
      )
    }
  }

  private async generateThumbnail(frameTimestamp: number) {
    const thumbFrame = (() => {
      const hours = String(Math.floor(frameTimestamp / 3600))
      const minutes = String(Math.floor((frameTimestamp % 3600) / 60))
      const seconds = String(frameTimestamp % 60)
      return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`
    })()

    const args = [
      "-y",
      "-hide_banner",
      "-i",
      INPUT_FILENAME,
      "-ss",
      thumbFrame,
      "-vframes",
      "1",
      "-vf",
      `scale=-2:720`,
      "-q:v",
      "5",
      "thumb.jpg",
    ]

    if (typeof window !== "undefined") {
      const dirContent = await ffmpeg.listDir(".")

      if (!dirContent.some((f) => f.name === INPUT_FILENAME)) {
        await this.writeInputFileIfNeeded()
      }

      await handleFFmpegPromise(ffmpeg.exec(args))

      const thumbData = (await ffmpeg.readFile("thumb.jpg")) as Uint8Array

      return thumbData
    } else {
      const ffmpeg = await this.getFFmpeg()

      await handleFFmpegPromise(ffmpeg.run(...args))

      const thumbData = ffmpeg.fs.readFile("thumb.jpg")

      return thumbData
    }
  }
}
