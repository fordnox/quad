import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { LOOP_PHASES } from '../engine/loopStateMachine.js';
import type { LoopState, PhaseResult } from '../engine/loopStateMachine.js';
import type { LoopPhase } from '../types/agent.js';
import { useTheme } from '../utils/ThemeProvider.js';
import type { ThemeColors, ThemeInkColors } from '../utils/theme.js';

export interface LoopStatusBarProps {
  loopState: LoopState;
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

function getLoopStatusColor(status: string, ink: ThemeInkColors): string {
  const map: Record<string, string> = {
    running: ink.loopRunning,
    paused: ink.loopPaused,
    idle: ink.loopIdle,
    error: ink.loopError,
  };
  return map[status] ?? 'white';
}

function formatPhaseSegment(
  phase: LoopPhase,
  result: PhaseResult,
  isCurrent: boolean,
  t: ThemeColors,
): string {
  const label = phase.toUpperCase();
  const colorFn = getPhaseColor(phase, t);

  if (result === 'success') {
    return t.success(`✓ ${label}`);
  }
  if (result === 'failed') {
    return t.agentError(`✗ ${label}`);
  }
  if (isCurrent) {
    return colorFn(chalk.bold(`[${label}]`));
  }
  // pending
  return t.dim(label);
}

function formatElapsedPhase(phaseStartedAt: Date | null): string {
  if (!phaseStartedAt) return '--:--';
  const elapsed = Math.floor((Date.now() - phaseStartedAt.getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LoopStatusBar({ loopState }: LoopStatusBarProps) {
  const { colors: t, ink } = useTheme();
  const { currentPhase, cycleCount, phaseStartedAt, status, phaseResults } = loopState;

  // Tick every second to update elapsed time when running
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const segments = LOOP_PHASES.map((phase, i) => {
    const isCurrent = status !== 'idle' && phase === currentPhase;
    const segment = formatPhaseSegment(phase, phaseResults[phase], isCurrent, t);
    const arrow = i < LOOP_PHASES.length - 1 ? t.dim(' → ') : '';
    return segment + arrow;
  }).join('');

  const statusLabel = status.toUpperCase();
  const statusColor = getLoopStatusColor(status, ink);

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text>{segments}</Text>
      <Text>
        <Text dimColor>Cycle #{cycleCount}</Text>
        {'  '}
        <Text dimColor>{formatElapsedPhase(phaseStartedAt)}</Text>
        {'  '}
        <Text bold color={statusColor}>{statusLabel}</Text>
      </Text>
    </Box>
  );
}
