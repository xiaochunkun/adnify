import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
	plugins: [
		react(),
		electron([
			{
				entry: 'src/main/main.ts',
				vite: {
					build: {
						outDir: 'dist/main',
						rollupOptions: {
							external: [
								'electron',
								'electron-store',
								'@anthropic-ai/sdk',
								'openai',
								'@google/generative-ai',
								'node-pty',
								'@parcel/watcher',
								'@parcel/watcher-win32-x64',
								'@parcel/watcher-win32-arm64',
								'@parcel/watcher-darwin-x64',
								'@parcel/watcher-darwin-arm64',
								'@parcel/watcher-linux-x64-glibc',
								'@parcel/watcher-linux-x64-musl',
								'@parcel/watcher-linux-arm64-glibc',
								'@parcel/watcher-linux-arm64-musl',
								'dugite',
								'@vscode/ripgrep',
								'@lancedb/lancedb',
								'apache-arrow'
							]
						}
					}
				}
			},
			{
				entry: 'src/main/preload.ts',
				onstart(options) {
					options.reload()
				},
				vite: {
					build: {
						outDir: 'dist/preload'
					}
				}
			}
		])
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	},
	base: './',
	build: {
		outDir: 'dist/renderer'
	}
})
