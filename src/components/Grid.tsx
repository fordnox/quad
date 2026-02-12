import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { AgentCard } from './AgentCard.js';
import { DetailView } from './DetailView.js';
import type { AgentState, AgentStatus } from '../types/agent.js';

export interface GridProps {
  agents: AgentState[];
  focusedAgentId?: string | null;
  detailMode?: boolean;
}

const statusLabels: AgentStatus[] = ['running', 'idle', 'finished', 'error'];

function buildStatusSummary(agents: AgentState[]): string {
  const counts = new Map<AgentStatus, number>();
  for (const agent of agents) {
    counts.set(agent.status, (counts.get(agent.status) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const status of statusLabels) {
    const count = counts.get(status);
    if (count && count > 0) {
      parts.push(`${count} ${status}`);
    }
  }
  return parts.join(', ');
}

export function Grid({ agents, focusedAgentId = null, detailMode = false }: GridProps) {
  const termWidth = process.stdout.columns || 80;
  const termHeight = process.stdout.rows || 24;

  const cardWidth = Math.floor(termWidth / 2);
  const cardHeight = Math.floor((termHeight - 4) / 2); // Reserve space for header + footer bars

  const summary = buildStatusSummary(agents);

  // Find the focused agent for detail mode
  const focusedAgent = focusedAgentId
    ? agents.find((a) => a.config.id === focusedAgentId)
    : undefined;

  // Render DetailView when in detail mode with a valid focused agent
  if (detailMode && focusedAgent) {
    return <DetailView agent={focusedAgent} />;
  }

  return (
    <Box flexDirection="column" width={termWidth}>
      {/* Header bar */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold>{chalk.white('QUAD')} {chalk.dim('—')} {chalk.cyan('GRID VIEW')}</Text>
        <Text dimColor>
          {agents.length} agent{agents.length !== 1 ? 's' : ''}{summary ? ` — ${summary}` : ''}
        </Text>
      </Box>

      {/* Agent grid */}
      <Box flexWrap="wrap">
        {agents.map((agent) => (
          <AgentCard
            key={agent.config.id}
            agent={agent}
            width={cardWidth}
            height={cardHeight}
            focused={agent.config.id === focusedAgentId}
          />
        ))}
      </Box>

      {/* Footer bar */}
      <Box paddingX={1}>
        <Text dimColor>
          {chalk.bold('[q]')} quit  {chalk.bold('[a]')} add agent  {chalk.bold('[Tab]')} focus  {chalk.bold('[Enter]')} detail  {chalk.bold('[k]')} kill focused  {chalk.bold('[r]')} restart
        </Text>
      </Box>
    </Box>
  );
}
