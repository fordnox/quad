import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import type { AgentState, AgentStatus, LoopPhase } from '../types/agent.js';
import type { ParsedOutputType } from '../parsers/outputParser.js';
import { useTheme } from '../utils/ThemeProvider.js';
import type { ThemeColors, ThemeInkColors } from '../utils/theme.js';

export interface AgentCardProps {
  agent: AgentState;
  width?: number;
  height?: number;
  focused?: boolean;
  assignedPhase?: LoopPhase | null;
  activeInCurrentPhase?: boolean;
}

function getBorderColor(status: AgentStatus, focused: boolean, ink: ThemeInkColors): string {
  if (focused) return ink.borderFocused;
  const map: Record<AgentStatus, string> = {
    idle: ink.agentIdle,
    running: ink.agentRunning,
    finished: ink.agentFinished,
    error: ink.agentError,
  };
  return map[status];
}

function getStatusDot(status: Exclude<AgentStatus, 'running'>, t: ThemeColors): string {
  const map: Record<Exclude<AgentStatus, 'running'>, string> = {
    idle: t.agentIdle('●'),
    finished: t.agentFinished('●'),
    error: t.agentError('●'),
  };
  return map[status];
}

function getTypeBadge(type: string, t: ThemeColors): string {
  const map: Record<string, (s: string) => string> = {
    claude: t.typeClaude,
    opencode: t.typeOpencode,
    custom: t.typeCustom,
  };
  return (map[type] ?? chalk.white)(`[${type}]`);
}

function getRoleBadge(role: string, t: ThemeColors): string {
  const map: Record<string, (s: string) => string> = {
    coder: t.roleCoder,
    auditor: t.roleAuditor,
    planner: t.rolePlanner,
    reviewer: t.roleReviewer,
    custom: t.roleCustom,
  };
  return (map[role] ?? chalk.white)(`[${role}]`);
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

function getOutputColor(type: ParsedOutputType, t: ThemeColors): (s: string) => string {
  const map: Record<ParsedOutputType, (s: string) => string> = {
    error: t.outputError,
    command: t.outputCommand,
    code: t.outputCode,
    progress: t.outputProgress,
    status: t.outputStatus,
    info: t.outputInfo,
    unknown: t.outputUnknown,
  };
  return map[type];
}

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
  const { colors: t, ink } = useTheme();
  const { config, status, phase, output, parsedOutput, currentActivity, pid, startedAt, restartCount } = agent;

  const cardWidth = width ?? Math.floor((process.stdout.columns || 80) / 2);
  const cardHeight = height ?? Math.floor((process.stdout.rows || 24) / 2);

  const borderColor = getBorderColor(status, focused, ink);
  const borderStyle = focused ? 'bold' : 'round';

  const typeBadge = getTypeBadge(config.type, t);
  const roleBadge = getRoleBadge(config.role, t);

  const phaseLabel = `[${phase.toUpperCase()}]`;

  // Build the assigned-phase label with active indicator
  let assignedPhaseLabel = '';
  if (assignedPhase) {
    const colorFn = getPhaseColor(assignedPhase, t);
    if (activeInCurrentPhase) {
      assignedPhaseLabel = colorFn(chalk.bold(`▸ ${assignedPhase.toUpperCase()}`));
    } else {
      assignedPhaseLabel = t.dim(assignedPhase.toUpperCase());
    }
  }

  const statusIndicator =
    status === 'running' ? (
      <Text color={ink.agentRunning}>
        <Spinner type="dots" />
      </Text>
    ) : (
      <Text>{getStatusDot(status, t)}</Text>
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
        <Text bold>{focused ? t.borderFocused('▶ ') : ''}{focused ? chalk.bold(config.name) : config.name}</Text>
        <Text>
          {typeBadge} {roleBadge}
        </Text>
      </Box>

      {/* Status + Phase */}
      <Box gap={1}>
        {statusIndicator}
        <Text bold color={status === 'running' ? ink.agentRunning : status === 'error' ? ink.agentError : undefined}>
          {phaseLabel}
        </Text>
        {assignedPhaseLabel ? <Text>{assignedPhaseLabel}</Text> : null}
        {restartCount > 0 ? <Text color={ink.loopPaused}>(restarted {restartCount}/3 times)</Text> : null}
      </Box>

      {/* Current Activity */}
      {currentActivity ? (
        <Box>
          <Text color={ink.activity} bold wrap="truncate">
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
              const colorFn = getOutputColor(parsed.type, t);
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
          <Text color={ink.loopPaused}>
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
