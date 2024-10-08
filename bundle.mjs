// @ts-check
import fs from "node:fs"
import path from "node:path"
import { build } from "vite"

// eslint-disable-next-line prettier/prettier
import packageJson from "./package.json" with { type: "json" }

const __dirname = path.dirname(new URL(import.meta.url).pathname)

const entries = [
  {
    entry: path.resolve("src/index.ts"),
    fileName: "index",
  },
  {
    entry: path.resolve("src/classes/index.ts"),
    fileName: "classes/index",
  },
  {
    entry: path.resolve("src/clients/index.ts"),
    fileName: "clients/index",
  },
  {
    entry: path.resolve("src/handlers/index.ts"),
    fileName: "handlers/index",
  },
  {
    entry: path.resolve("src/serializers/index.ts"),
    fileName: "serializers/index",
  },
  {
    entry: path.resolve("src/stores/index.ts"),
    fileName: "stores/index",
  },
  {
    entry: path.resolve("src/swarm/index.ts"),
    fileName: "swarm/index",
  },
  {
    entry: path.resolve("src/utils/index.ts"),
    fileName: "utils/index",
  },
]

// Clean 'dist' folder

const DIST_PATH = path.resolve("dist")
if (fs.existsSync(DIST_PATH)) {
  fs.rmSync(DIST_PATH, { recursive: true })
}

// Bundle

const watch = process.argv.includes("--watch")

const results = await Promise.allSettled(
  entries.map((lib) =>
    build({
      mode: watch ? "development" : "production",
      build: {
        outDir: "./dist",
        lib: {
          ...lib,
          formats: ["es"],
        },
        emptyOutDir: false,
        sourcemap: true,
        minify: "esbuild",
        target: "es2020",
        rollupOptions: {
          external: Object.keys(packageJson.peerDependencies),
          treeshake: true,
        },
      },
      resolve: {
        alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
      },
    }),
  ),
)

results.forEach((result, i) => {
  if (result.status === "rejected") {
    return console.log(`\x1b[31mTask ${entries[i]} failed. ${result.reason}\x1b[0m`)
  }

  if (Array.isArray(result.value)) return
  if ("output" in result.value) return

  result.value.on("change", (path) => {
    console.log(`File ${path} has been changed`)
  })
})

// Copy & edit package.json / README

/** @type {Record<string, any>} */
const packageCopy = packageJson
packageCopy.scripts = {}
packageCopy.dependencies = {}
packageCopy.devDependencies = {}
packageCopy.type = "module"
delete packageCopy.optionalDependencies
delete packageCopy.pnpm

// package.json
fs.writeFileSync(
  path.join(DIST_PATH, "package.json"),
  Buffer.from(JSON.stringify(packageCopy, null, 2), "utf-8"),
)

// README.md
fs.writeFileSync(path.join(DIST_PATH, "README.md"), fs.readFileSync(path.resolve("README.md")))

if (watch) {
  process.stdin.resume()
} else {
  process.exit(0)
}
