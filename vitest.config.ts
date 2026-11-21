import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/main/**/*.test.ts', 'tests/packaging/**/*.test.ts'],
    passWithNoTests: true,
  },
})
