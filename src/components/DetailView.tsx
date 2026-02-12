import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { AgentState, AgentStatus } from '../types/agent.js';

export interface DetailViewProps {
  agent: AgentState;
  isActive?: boolean;
}

const statusColorMap: Record<AgentStatus, string> = {
  idle: 'gray',
  running: 'green',
  finished: 'blue',
  error: 'red',
};

const typeBadgeColor: Record<string, (s: string) => string> = {
  claude: chalk.magenta,
  opencode: chalk.cyan,
  custom: chalk.yellow,
};

const roleBadgeColor: Record<string, (s: string) => string> = {
  coder: chalk.green,
  auditor: chalk.blue,
  planner: chalk.yellow,
  reviewer: chalk.cyan,
  custom: chalk.white,
};

function formatElapsed(startedAt: Date | null): string {
  if (!startedAt) return '--:--';
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatStartTime(startedAt: Date | null): string {
  if (!startedAt) return '---';
  return startedAt.toLocaleTimeString();
}

const MAX_VISIBLE_LINES = 200;

export function DetailView({ agent, isActive = true }: DetailViewProps) {
  const { config, status, phase, output, pid, startedAt, error } = agent;
  const [scrollOffset, setScrollOffset] = useState(0);

  const termWidth = process.stdout.columns || 80;
  const termHeight = process.stdout.rows || 24;

  // Header (1) + metadata (3) + separator (1) + footer hint (1) + borders (2) = 8 reserved lines
  const outputAreaHeight = Math.max(1, termHeight - 8);

  // Clamp output to MAX_VISIBLE_LINES
  const allLines = output.slice(-MAX_VISIBLE_LINES);
  const maxScroll = Math.max(0, allLines.length - outputAreaHeight);

  // Auto-scroll to bottom when new output arrives (if already at bottom)
  useEffect(() => {
    setScrollOffset((prev) => {
      const prevMaxScroll = Math.max(0, allLines.length - 1 - outputAreaHeight);
      if (prev >= prevMaxScroll) {
        return maxScroll;
      }
      return Math.min(prev, maxScroll);
    });
  }, [allLines.length, maxScroll, outputAreaHeight]);

  useInput((input, key) => {
    if (key.upArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
    }
    if (key.pageDown) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + outputAreaHeight));
    }
    if (key.pageUp) {
      setScrollOffset((prev) => Math.max(0, prev - outputAreaHeight));
    }
  }, { isActive });

  const visibleLines = allLines.slice(scrollOffset, scrollOffset + outputAreaHeight);

  const typeBadge = (typeBadgeColor[config.type] ?? chalk.white)(`[${config.type}]`);
  const roleBadge = (roleBadgeColor[config.role] ?? chalk.white)(`[${config.role}]`);

  const statusIndicator =
    status === 'running' ? (
      <Text color="green">
        <Spinner type="dots" />
        {' '}
      </Text>
    ) : (
      <Text color={statusColorMap[status]}>● </Text>
    );

  const scrollIndicator = allLines.length > outputAreaHeight
    ? ` (${scrollOffset + 1}-${Math.min(scrollOffset + outputAreaHeight, allLines.length)}/${allLines.length})`
    : '';

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight}>
      {/* Header bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box gap={1}>
          <Text bold>{chalk.yellow('DETAIL:')}</Text>
          <Text bold>{config.name}</Text>
          <Text>{typeBadge} {roleBadge}</Text>
        </Box>
        <Box gap={1}>
          {statusIndicator}
          <Text bold color={status === 'running' ? 'green' : status === 'error' ? 'red' : undefined}>
            [{phase.toUpperCase()}]
          </Text>
        </Box>
      </Box>

      {/* Metadata line */}
      <Box paddingX={1} gap={2}>
        <Text dimColor>PID: {pid ?? '---'}</Text>
        <Text dimColor>Started: {formatStartTime(startedAt)}</Text>
        <Text dimColor>Elapsed: {formatElapsed(startedAt)}</Text>
        <Text dimColor>Status: {status}</Text>
        {error ? <Text color="red">Error: {error}</Text> : null}
      </Box>

      {/* Separator */}
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(Math.max(1, termWidth - 2))}</Text>
      </Box>

      {/* Output area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleLines.map((line, i) => (
          <Text key={scrollOffset + i}>{line}</Text>
        ))}
      </Box>

      {/* Footer hint bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text dimColor>
          {chalk.bold('[Escape]')} back to grid  {chalk.bold('[k]')} kill  {chalk.bold('[r]')} restart
        </Text>
        <Text dimColor>
          {chalk.bold('[↑/↓]')} scroll{scrollIndicator}
        </Text>
      </Box>
    </Box>
  );
}
