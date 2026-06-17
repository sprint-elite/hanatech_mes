import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { dependencies?: Record<string, string> }

export default defineConfig({
  entry: ['src/server/index.ts'],
  outDir: 'dist/server',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  // dotenv/prisma 등은 node_modules에서 로드 (번들 시 dynamic require 오류 방지)
  external: [...Object.keys(pkg.dependencies ?? {}), 'dotenv'],
})

