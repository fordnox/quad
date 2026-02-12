import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { AgentState, AgentStatus } from '../types/agent.js';
import type { ParsedOutput, ParsedOutputType } from '../parsers/outputParser.js';

export type OutputFilter = 'all' | 'errors' | 'commands';

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

const outputTypeColorMap: Record<ParsedOutputType, (s: string) => string> = {
  error: chalk.red,
  command: chalk.green,
  code: chalk.blue,
  progress: chalk.yellow,
  status: chalk.cyan,
  info: chalk.white,
  unknown: chalk.dim,
};

const filterTypeMap: Record<OutputFilter, ParsedOutputType[] | null> = {
  all: null,
  errors: ['error'],
  commands: ['command'],
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

function colorLine(parsed: ParsedOutput): string {
  const colorFn = outputTypeColorMap[parsed.type];
  return colorFn(parsed.raw);
}

function filterParsedOutput(entries: ParsedOutput[], filter: OutputFilter): ParsedOutput[] {
  const allowedTypes = filterTypeMap[filter];
  if (!allowedTypes) return entries;
  return entries.filter((entry) => allowedTypes.includes(entry.type));
}

const MAX_VISIBLE_LINES = 200;

export function DetailView({ agent, isActive = true }: DetailViewProps) {
  const { config, status, phase, output, parsedOutput, currentActivity, pid, startedAt, error } = agent;
  const [scrollOffset, setScrollOffset] = useState(0);
  const [filter, setFilter] = useState<OutputFilter>('all');

  const termWidth = process.stdout.columns || 80;
  const termHeight = process.stdout.rows || 24;

  // Header (1) + metadata (3) + activity (1) + separator (1) + footer hint (1) + borders (2) = 9 reserved lines
  const outputAreaHeight = Math.max(1, termHeight - 9);

  const useParsed = (parsedOutput ?? []).length > 0;

  // Apply filter and clamp to MAX_VISIBLE_LINES
  const allParsed = filterParsedOutput((parsedOutput ?? []).slice(-MAX_VISIBLE_LINES), filter);
  const allRaw = output.slice(-MAX_VISIBLE_LINES);
  const totalLines = useParsed ? allParsed.length : allRaw.length;
  const maxScroll = Math.max(0, totalLines - outputAreaHeight);

  // Auto-scroll to bottom when new output arrives (if already at bottom)
  useEffect(() => {
    setScrollOffset((prev) => {
      const prevMaxScroll = Math.max(0, totalLines - 1 - outputAreaHeight);
      if (prev >= prevMaxScroll) {
        return maxScroll;
      }
      return Math.min(prev, maxScroll);
    });
  }, [totalLines, maxScroll, outputAreaHeight]);

  // Reset scroll on filter change
  useEffect(() => {
    setScrollOffset(maxScroll);
  }, [filter]);

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

    // Filter keys
    if (input === '1') {
      setFilter('all');
    }
    if (input === '2') {
      setFilter('errors');
    }
    if (input === '3') {
      setFilter('commands');
    }
  }, { isActive });

  const visibleParsed = useParsed ? allParsed.slice(scrollOffset, scrollOffset + outputAreaHeight) : [];
  const visibleRaw = !useParsed ? allRaw.slice(scrollOffset, scrollOffset + outputAreaHeight) : [];

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

  const scrollIndicator = totalLines > outputAreaHeight
    ? ` (${scrollOffset + 1}-${Math.min(scrollOffset + outputAreaHeight, totalLines)}/${totalLines})`
    : '';

  const filterLabel = filter === 'all'
    ? chalk.bold.white('[ALL]')
    : filter === 'errors'
      ? chalk.bold.red('[ERRORS]')
      : chalk.bold.green('[COMMANDS]');

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

      {/* Current activity line */}
      <Box paddingX={1} gap={2}>
        {currentActivity ? (
          <Text color="cyan" bold>▸ {currentActivity}</Text>
        ) : (
          <Text dimColor>▸ waiting...</Text>
        )}
        <Text>{filterLabel}</Text>
      </Box>

      {/* Separator */}
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(Math.max(1, termWidth - 2))}</Text>
      </Box>

      {/* Output area — color-coded by parsed type */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {useParsed
          ? visibleParsed.map((parsed, i) => (
              <Box key={scrollOffset + i} gap={1}>
                <Text>{colorLine(parsed)}</Text>
                {parsed.summary ? (
                  <Text dimColor> {chalk.italic(`[${parsed.summary}]`)}</Text>
                ) : null}
              </Box>
            ))
          : visibleRaw.map((line, i) => (
              <Text key={scrollOffset + i}>{line}</Text>
            ))}
      </Box>

      {/* Footer hint bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text dimColor>
          {chalk.bold('[Escape]')} back  {chalk.bold('[k]')} kill  {chalk.bold('[r]')} restart  {chalk.bold('[1]')} all  {chalk.bold('[2]')} errors  {chalk.bold('[3]')} commands
        </Text>
        <Text dimColor>
          {chalk.bold('[↑/↓]')} scroll{scrollIndicator}
        </Text>
      </Box>
    </Box>
  );
}
