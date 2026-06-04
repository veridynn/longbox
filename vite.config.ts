import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	staged: {
		'*': 'vp check --fix'
	},
	fmt: {
		useTabs: true,
		singleQuote: true,
		trailingComma: 'none',
		printWidth: 100,
		sortTailwindcss: {
			stylesheet: './src/routes/layout.css',
			functions: ['clsx', 'cn']
		}
	},
	lint: {
		plugins: ['typescript'],
		options: { typeAware: true, typeCheck: true },
		rules: {
			'typescript/no-empty-object-type': 'error',
			'typescript/no-explicit-any': 'error'
		}
	},
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
