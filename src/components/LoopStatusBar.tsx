import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { LOOP_PHASES } from '../engine/loopStateMachine.js';
import type { LoopState, PhaseResult } from '../engine/loopStateMachine.js';
import type { LoopPhase } from '../types/agent.js';

export interface LoopStatusBarProps {
  loopState: LoopState;
}

const phaseColors: Record<string, (s: string) => string> = {
  plan: chalk.yellow,
  code: chalk.green,
  audit: chalk.blue,
  push: chalk.magenta,
};

const statusColors: Record<string, string> = {
  running: 'green',
  paused: 'yellow',
  idle: 'gray',
  error: 'red',
};

function formatPhaseSegment(
  phase: LoopPhase,
  result: PhaseResult,
  isCurrent: boolean,
): string {
  const label = phase.toUpperCase();
  const colorFn = phaseColors[phase] ?? chalk.white;

  if (result === 'success') {
    return chalk.green(`✓ ${label}`);
  }
  if (result === 'failed') {
    return chalk.red(`✗ ${label}`);
  }
  if (isCurrent) {
    return colorFn(chalk.bold(`[${label}]`));
  }
  // pending
  return chalk.dim(label);
}

function formatElapsedPhase(phaseStartedAt: Date | null): string {
  if (!phaseStartedAt) return '--:--';
  const elapsed = Math.floor((Date.now() - phaseStartedAt.getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LoopStatusBar({ loopState }: LoopStatusBarProps) {
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
    const segment = formatPhaseSegment(phase, phaseResults[phase], isCurrent);
    const arrow = i < LOOP_PHASES.length - 1 ? chalk.dim(' → ') : '';
    return segment + arrow;
  }).join('');

  const statusLabel = status.toUpperCase();
  const statusColor = statusColors[status] ?? 'white';

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
