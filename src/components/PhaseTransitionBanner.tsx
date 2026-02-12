import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { LoopEvent, LoopEventListener } from '../hooks/useLoop.js';
import type { LoopPhase } from '../types/agent.js';

export interface PhaseTransitionBannerProps {
  onLoopEvent: (listener: LoopEventListener) => void;
  offLoopEvent: (listener: LoopEventListener) => void;
  /** Duration in ms before auto-dismiss. Defaults to 3000. */
  dismissAfter?: number;
}

interface BannerMessage {
  text: string;
  id: number;
}

const phaseColors: Record<string, (s: string) => string> = {
  plan: chalk.yellow,
  code: chalk.green,
  audit: chalk.blue,
  push: chalk.magenta,
};

function colorPhase(phase: LoopPhase): string {
  const colorFn = phaseColors[phase] ?? chalk.white;
  return colorFn(phase.toUpperCase());
}

function buildMessage(event: LoopEvent): string | null {
  switch (event.type) {
    case 'phase-advance':
      return `→ Entering ${colorPhase(event.to)} phase`;
    case 'cycle-complete':
      return chalk.green(`✓ Cycle #${event.cycleCount} complete`) + ' — restarting loop';
    case 'phase-fail':
      return chalk.red(`✗ ${event.phase.toUpperCase()} phase failed`) + ' — loop paused';
    default:
      return null;
  }
}

let nextId = 0;

export function PhaseTransitionBanner({
  onLoopEvent,
  offLoopEvent,
  dismissAfter = 3000,
}: PhaseTransitionBannerProps) {
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent: LoopEventListener = useCallback(
    (event: LoopEvent) => {
      const text = buildMessage(event);
      if (text === null) return;

      // Clear any existing dismiss timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      const id = ++nextId;
      setBanner({ text, id });

      timerRef.current = setTimeout(() => {
        setBanner((current) => {
          // Only dismiss if it's still the same banner
          if (current && current.id === id) return null;
          return current;
        });
        timerRef.current = null;
      }, dismissAfter);
    },
    [dismissAfter],
  );

  useEffect(() => {
    onLoopEvent(handleEvent);
    return () => {
      offLoopEvent(handleEvent);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [onLoopEvent, offLoopEvent, handleEvent]);

  if (!banner) return null;

  return (
    <Box justifyContent="center" paddingX={1}>
      <Text bold>{banner.text}</Text>
    </Box>
  );
}
