export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Changed from 'node' to 'jsdom' for React component testing
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy' // Mock CSS imports
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Explicitly set options that were causing issues
          esModuleInterop: true,
          jsx: 'react-jsx',
          // Add other necessary options if they arise
        },
      },
    ],
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Removed extensionsToTreatAsEsm as it's often problematic with Jest + ts-jest default setup
  setupFilesAfterEnv: ['@testing-library/jest-dom'], // Changed path for DOM matchers
};