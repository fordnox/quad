import React from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../utils/ThemeProvider.js';

export interface BridgeStatusProps {
  apiPort: number;
  jobFilePath: string;
  apiRequestCount: number;
}

export function BridgeStatus({ apiPort, jobFilePath, apiRequestCount }: BridgeStatusProps) {
  const { colors: t, ink } = useTheme();

  return (
    <Box paddingX={1} gap={2}>
      <Text>
        {t.hintKey('API:')} <Text color={ink.success}>localhost:{apiPort} ✓</Text>
      </Text>
      <Text>
        {t.hintKey('Jobs:')} <Text dimColor>{jobFilePath}</Text>
      </Text>
      <Text>
        {t.hintKey('API requests:')} <Text dimColor>{apiRequestCount}</Text>
      </Text>
    </Box>
  );
}
