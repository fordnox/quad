import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { LoopEvent, LoopEventListener } from '../hooks/useLoop.js';
import type { LoopPhase } from '../types/agent.js';
import { useTheme } from '../utils/ThemeProvider.js';
import type { ThemeColors } from '../utils/theme.js';

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

function getPhaseColor(phase: string, t: ThemeColors): (s: string) => string {
  const map: Record<string, (s: string) => string> = {
    plan: t.phasePlan,
    code: t.phaseCode,
    audit: t.phaseAudit,
    push: t.phasePush,
  };
  return map[phase] ?? chalk.white;
}

function colorPhase(phase: LoopPhase, t: ThemeColors): string {
  const colorFn = getPhaseColor(phase, t);
  return colorFn(phase.toUpperCase());
}

function buildMessage(event: LoopEvent, t: ThemeColors): string | null {
  switch (event.type) {
    case 'phase-advance':
      return `→ Entering ${colorPhase(event.to, t)} phase`;
    case 'cycle-complete':
      return t.success(`✓ Cycle #${event.cycleCount} complete`) + ' — restarting loop';
    case 'phase-fail':
      return t.agentError(`✗ ${event.phase.toUpperCase()} phase failed`) + ' — loop paused';
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
  const { colors: t } = useTheme();
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent: LoopEventListener = useCallback(
    (event: LoopEvent) => {
      const text = buildMessage(event, t);
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
    [dismissAfter, t],
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
