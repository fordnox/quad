import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { AgentState, AgentStatus, LoopPhase } from '../types/agent.js';
import type { ParsedOutputType } from '../parsers/outputParser.js';

export interface AgentCardProps {
  agent: AgentState;
  width?: number;
  height?: number;
  focused?: boolean;
  assignedPhase?: LoopPhase | null;
  activeInCurrentPhase?: boolean;
}

const borderColorMap: Record<AgentStatus, string> = {
  idle: 'gray',
  running: 'green',
  finished: 'blue',
  error: 'red',
};

const statusDotMap: Record<Exclude<AgentStatus, 'running'>, string> = {
  idle: chalk.gray('●'),
  finished: chalk.blue('●'),
  error: chalk.red('●'),
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

const phaseColorMap: Record<string, (s: string) => string> = {
  plan: chalk.yellow,
  code: chalk.green,
  audit: chalk.blue,
  push: chalk.magenta,
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

function formatElapsed(startedAt: Date | null): string {
  if (!startedAt) return '--:--';
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function renderProgressBar(current: number, total: number, width: number): string {
  const barWidth = Math.max(4, width - 2); // leave room for brackets
  const ratio = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

export function AgentCard({ agent, width, height, focused = false, assignedPhase = null, activeInCurrentPhase = false }: AgentCardProps) {
  const { config, status, phase, output, parsedOutput, currentActivity, pid, startedAt } = agent;

  const cardWidth = width ?? Math.floor((process.stdout.columns || 80) / 2);
  const cardHeight = height ?? Math.floor((process.stdout.rows || 24) / 2);

  const borderColor = focused ? 'yellow' : borderColorMap[status];
  const borderStyle = focused ? 'bold' : 'round';

  const typeBadge = (typeBadgeColor[config.type] ?? chalk.white)(`[${config.type}]`);
  const roleBadge = (roleBadgeColor[config.role] ?? chalk.white)(`[${config.role}]`);

  const phaseLabel = `[${phase.toUpperCase()}]`;

  // Build the assigned-phase label with active indicator
  let assignedPhaseLabel = '';
  if (assignedPhase) {
    const colorFn = phaseColorMap[assignedPhase] ?? chalk.white;
    if (activeInCurrentPhase) {
      assignedPhaseLabel = colorFn(chalk.bold(`▸ ${assignedPhase.toUpperCase()}`));
    } else {
      assignedPhaseLabel = chalk.dim(assignedPhase.toUpperCase());
    }
  }

  const statusIndicator =
    status === 'running' ? (
      <Text color="green">
        <Spinner type="dots" />
      </Text>
    ) : (
      <Text>{statusDotMap[status]}</Text>
    );

  // Find the most recent progress entry for the mini progress bar
  const latestProgress = [...(parsedOutput ?? [])].reverse().find((p) => p.progress !== null);

  // Reserve lines for header (2), activity (1), progress bar (1 if present), footer (1), borders (2) = 7-8
  const progressBarPresent = latestProgress?.progress ? 1 : 0;
  const outputAreaHeight = Math.max(1, cardHeight - 7 - progressBarPresent);

  // Use parsedOutput for color-coded display, falling back to raw output
  const recentParsed = (parsedOutput ?? []).slice(-outputAreaHeight);
  const recentRaw = output.slice(-outputAreaHeight);
  const useParsed = recentParsed.length > 0;

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={borderColor}
      width={cardWidth}
      height={cardHeight}
      paddingX={1}
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold>{focused ? chalk.yellow('▶ ') : ''}{focused ? chalk.bold(config.name) : config.name}</Text>
        <Text>
          {typeBadge} {roleBadge}
        </Text>
      </Box>

      {/* Status + Phase */}
      <Box gap={1}>
        {statusIndicator}
        <Text bold color={status === 'running' ? 'green' : status === 'error' ? 'red' : undefined}>
          {phaseLabel}
        </Text>
        {assignedPhaseLabel ? <Text>{assignedPhaseLabel}</Text> : null}
      </Box>

      {/* Current Activity */}
      {currentActivity ? (
        <Box>
          <Text color="cyan" bold wrap="truncate">
            {'▸ '}{currentActivity}
          </Text>
        </Box>
      ) : (
        <Box>
          <Text dimColor>▸ waiting...</Text>
        </Box>
      )}

      {/* Output area — color-coded by parsed type */}
      <Box flexDirection="column" flexGrow={1}>
        {useParsed
          ? recentParsed.map((parsed, i) => {
              const colorFn = outputTypeColorMap[parsed.type];
              return (
                <Text key={i}>
                  {colorFn(parsed.summary ?? parsed.raw)}
                </Text>
              );
            })
          : recentRaw.map((line, i) => (
              <Text key={i} dimColor>
                {line}
              </Text>
            ))}
      </Box>

      {/* Mini progress bar */}
      {latestProgress?.progress ? (
        <Box>
          <Text color="yellow">
            {renderProgressBar(latestProgress.progress.current, latestProgress.progress.total, Math.max(10, cardWidth - 4))}
            {' '}{latestProgress.progress.current}/{latestProgress.progress.total}
          </Text>
        </Box>
      ) : null}

      {/* Footer */}
      <Box justifyContent="space-between">
        <Text dimColor>PID: {pid ?? '---'}</Text>
        <Text dimColor>Elapsed: {formatElapsed(startedAt)}</Text>
      </Box>
    </Box>
  );
}
