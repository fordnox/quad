import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

export interface BridgeStatusProps {
  apiPort: number;
  jobFilePath: string;
  apiRequestCount: number;
}

export function BridgeStatus({ apiPort, jobFilePath, apiRequestCount }: BridgeStatusProps) {
  return (
    <Box paddingX={1} gap={2}>
      <Text>
        {chalk.bold('API:')} <Text color="green">localhost:{apiPort} ✓</Text>
      </Text>
      <Text>
        {chalk.bold('Jobs:')} <Text dimColor>{jobFilePath}</Text>
      </Text>
      <Text>
        {chalk.bold('API requests:')} <Text dimColor>{apiRequestCount}</Text>
      </Text>
    </Box>
  );
}
