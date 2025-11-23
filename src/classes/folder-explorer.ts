import { MantarayNode } from "./mantaray-node"
import { EthernaSdkError } from "./sdk-error"
import { BeeClient } from "@/clients"
import { Reference } from "@/types"
import { getAllPaths } from "@/utils"
import { bytesReferenceToReference, referenceToBytesReference } from "@/utils/reference"

export interface FolderExplorerOptions {
  beeClient: BeeClient
}

export interface FolderEntryFile {
  type: "file"
  metadata: Record<string, string>
  name: string
}

export interface FolderEntryDirectory {
  type: "directory"
  children: FolderExplorerEntry[]
  name: string
}

export type FolderExplorerEntry = FolderEntryFile | FolderEntryDirectory

export class FolderExplorer {
  private reference: Reference | undefined
  private mantaray: MantarayNode
  private entries: FolderExplorerEntry[] | null = null
  private beeClient: BeeClient

  constructor(reference: Reference, options: FolderExplorerOptions)
  constructor(node: MantarayNode, options: FolderExplorerOptions)
  constructor(init: Reference | MantarayNode, options: FolderExplorerOptions) {
    if (init instanceof MantarayNode) {
      this.mantaray = init
      this.loadEntries()
    } else {
      this.reference = init
      this.mantaray = new MantarayNode()
    }

    this.beeClient = options.beeClient
  }

  public async loadFolder() {
    if (!this.reference) {
      throw new EthernaSdkError(
        "BAD_REQUEST",
        "Load mantaray node directly or pass a reference as argument.",
      )
    }

    if (this.mantaray.isDirty()) {
      await this.mantaray.load(
        (reference) =>
          this.beeClient.bytes.download(bytesReferenceToReference(reference)).catch((err) => {
            if (err instanceof EthernaSdkError && err.code === "NOT_FOUND") {
              // sometimes first time download fails
              return this.beeClient.bytes.download(bytesReferenceToReference(reference))
            }
            throw err
          }),
        referenceToBytesReference(this.reference),
      )
    }

    this.loadEntries()
  }

  public entriesAtPath(path: string) {
    if (!this.entries) {
      throw new EthernaSdkError(
        "BAD_REQUEST",
        "Folder not loaded. Run FolderExplorer.loadFolder() or MantarayNode.load() first.",
      )
    }

    const segments = path.split("/").filter(Boolean)

    let currentDirectory = this.entries

    for (const [index, segment] of segments.entries()) {
      if (index === segments.length - 1) {
        return (
          currentDirectory.find((entry) => entry.name === segment && entry.type === "directory") as
            | (FolderExplorerEntry & { type: "directory" })
            | undefined
        )?.children
      }

      const dirEntry = currentDirectory.find(
        (entry) => entry.name === segment && entry.type === "directory",
      ) as (FolderExplorerEntry & { type: "directory" }) | undefined

      if (!dirEntry) {
        throw new EthernaSdkError("NOT_FOUND", `Directory ${segment} not found.`)
      }

      currentDirectory = dirEntry.children
    }

    return currentDirectory
  }

  public fileAtPath(path: string) {
    if (!this.entries) {
      throw new EthernaSdkError(
        "BAD_REQUEST",
        "Folder not loaded. Run FolderExplorer.loadFolder() or MantarayNode.load() first.",
      )
    }

    const fixedPath = path.replace(/^\/+/, "").replace(/\/+$/, "")
    const segments = fixedPath.split("/").filter(Boolean)

    if (fixedPath === "") {
      return this.entries.find((entry) => entry.type === "file" && entry.name === fixedPath) as
        | FolderEntryFile
        | undefined
    }

    const parentPath = segments.slice(0, -1).join("/")
    const parentEntries = this.entriesAtPath(parentPath) ?? []
    const filename = segments.pop()

    if (!filename) {
      return undefined
    }

    const fileEntry = parentEntries.find(
      (entry) => entry.name === filename && entry.type === "file",
    ) as FolderEntryFile | undefined

    return fileEntry
  }

  private loadEntries() {
    const entries = [] as FolderExplorerEntry[]

    const allFilesNodes = getAllPaths(this.mantaray)

    Object.entries(allFilesNodes).forEach(([path, node]) => {
      const segments = path.split("/")

      let currentDirectory = entries

      segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
          currentDirectory.push({
            name: segment,
            type: "file",
            metadata: node.metadata ?? {},
          })
        } else {
          if (segment === "") {
            return
          }

          let dirEntry = currentDirectory.find(
            (entry) => entry.name === segment && entry.type === "directory",
          ) as FolderEntryDirectory | undefined

          if (!dirEntry) {
            dirEntry = {
              name: segment,
              type: "directory",
              children: [],
            } satisfies FolderEntryDirectory
            currentDirectory.push(dirEntry)
          }

          currentDirectory = dirEntry.children
        }
      })
    })

    this.entries = entries
  }
}
