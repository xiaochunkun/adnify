/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				'editor': {
					'bg': '#0d1117',
					'sidebar': '#161b22',
					'border': '#30363d',
					'hover': '#21262d',
					'active': '#1f6feb',
					'text': '#c9d1d9',
					'text-muted': '#8b949e',
					'accent': '#58a6ff',
					'success': '#3fb950',
					'warning': '#d29922',
					'error': '#f85149',
				}
			},
			fontFamily: {
				'mono': ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
				'sans': ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
			},
			animation: {
				'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'gradient': 'gradient 8s linear infinite',
			},
			keyframes: {
				gradient: {
					'0%, 100%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' },
				}
			}
		},
	},
	plugins: [],
}
