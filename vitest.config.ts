import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 纯领域层测试配置：不依赖 Cocos / DOM / 平台 SDK
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    coverage: { enabled: false },
  },
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./assets/core', import.meta.url)),
    },
  },
});
