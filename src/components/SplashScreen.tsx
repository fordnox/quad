import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { useConfig } from '../config/ConfigProvider.js';

export interface SplashScreenProps {
  /** Duration in ms before the splash disappears. Defaults to 1500. */
  duration?: number;
  /** Called when the splash is dismissed. */
  onDone: () => void;
}

/** Gradient preset for each theme. */
const themeGradients: Record<string, { name?: string; colors?: string[] }> = {
  default: { name: 'vice' as const },
  minimal: { colors: ['#888888', '#FFFFFF', '#888888'] },
  neon: { name: 'rainbow' as const },
};

export function SplashScreen({ duration = 1500, onDone }: SplashScreenProps) {
  const config = useConfig();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  if (!visible) return null;

  const gradientProps = themeGradients[config.theme] ?? themeGradients.default;

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width={process.stdout.columns || 80}
      height={process.stdout.rows || 24}
    >
      <Gradient {...(gradientProps as any)}>
        <BigText text="QUAD" font="block" />
      </Gradient>
      <Text dimColor>Multi-Agent TUI Orchestrator</Text>
    </Box>
  );
}
