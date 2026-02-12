import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { AgentState, AgentStatus, LoopPhase } from '../types/agent.js';

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

function formatElapsed(startedAt: Date | null): string {
  if (!startedAt) return '--:--';
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function AgentCard({ agent, width, height, focused = false, assignedPhase = null, activeInCurrentPhase = false }: AgentCardProps) {
  const { config, status, phase, output, pid, startedAt } = agent;

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

  // Reserve lines for header (2), phase (1), footer (1), borders (2) = 6
  const outputAreaHeight = Math.max(1, cardHeight - 6);
  const visibleLines = output.slice(-outputAreaHeight);

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

      {/* Output area */}
      <Box flexDirection="column" flexGrow={1}>
        {visibleLines.map((line, i) => (
          <Text key={i} dimColor>
            {line}
          </Text>
        ))}
      </Box>

      {/* Footer */}
      <Box justifyContent="space-between">
        <Text dimColor>PID: {pid ?? '---'}</Text>
        <Text dimColor>Elapsed: {formatElapsed(startedAt)}</Text>
      </Box>
    </Box>
  );
}
