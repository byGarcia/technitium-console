import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/* The build injects this from package.json (see vite.config.ts). The tests run
   through a different config, so it has to be injected here as well or anything
   that reports the console's own version throws. */
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  plugins: [react()],
  define: { __CONSOLE_VERSION__: JSON.stringify(version) },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
