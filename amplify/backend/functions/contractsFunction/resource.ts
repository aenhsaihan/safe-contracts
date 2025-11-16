import { defineFunction } from '@aws-amplify/backend';

export const contractsFunction = defineFunction({
  name: 'contractsFunction',
  entry: './src/handler.ts',
});

