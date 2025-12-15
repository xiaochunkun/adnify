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
							external: ['electron', 'electron-store', '@anthropic-ai/sdk', 'openai', '@google/generative-ai']
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
