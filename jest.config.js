/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'api',
      testMatch: ['<rootDir>/apps/api/**/*.spec.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'apps/api/tsconfig.app.json' }] },
      moduleNameMapper: { '@app/shared(.*)': '<rootDir>/libs/shared/src$1' },
      testEnvironment: 'node',
    },
    {
      displayName: 'ai-service',
      testMatch: ['<rootDir>/apps/ai-service/**/*.spec.ts'],
      transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'apps/ai-service/tsconfig.app.json' }] },
      moduleNameMapper: { '@app/shared(.*)': '<rootDir>/libs/shared/src$1' },
      testEnvironment: 'node',
    },
  ],
};
