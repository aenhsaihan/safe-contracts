import { defineFunction } from '@aws-amplify/backend';

export const contractsFunction = defineFunction({
  name: 'contractsFunction',
  entry: './src/handler.ts',
  runtime: 20, // Node.js 20 for stable fetch() API support
});

