import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://127.0.0.1:4176' },
	webServer: {
		command: 'LONGBOX_E2E=1 vp build && LONGBOX_E2E=1 vp preview --host 127.0.0.1 --port 4176',
		port: 4176
	},
	testMatch: '**/*.e2e.{ts,js}'
});
