import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { AgentCard } from './AgentCard.js';
import { DetailView } from './DetailView.js';
import type { AgentState, AgentStatus, LoopPhase } from '../types/agent.js';
import type { LoopState } from '../engine/loopStateMachine.js';
import type { PhaseAssignments } from '../engine/loopOrchestrator.js';

export interface GridProps {
  agents: AgentState[];
  focusedAgentId?: string | null;
  detailMode?: boolean;
  loopState?: LoopState;
  assignments?: PhaseAssignments;
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

/** Find the loop phase an agent is assigned to based on the assignments map. */
function getAgentAssignedPhase(agentId: string, assignments?: PhaseAssignments): LoopPhase | null {
  if (!assignments) return null;
  for (const phase of ['plan', 'code', 'audit', 'push'] as LoopPhase[]) {
    if (assignments[phase].includes(agentId)) {
      return phase;
    }
  }
  return null;
}

export function Grid({ agents, focusedAgentId = null, detailMode = false, loopState, assignments }: GridProps) {
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
        {agents.map((agent) => {
          const assignedPhase = getAgentAssignedPhase(agent.config.id, assignments);
          const isActiveInPhase = loopState?.status === 'running' && assignedPhase === loopState.currentPhase;
          return (
            <AgentCard
              key={agent.config.id}
              agent={agent}
              width={cardWidth}
              height={cardHeight}
              focused={agent.config.id === focusedAgentId}
              assignedPhase={assignedPhase}
              activeInCurrentPhase={isActiveInPhase ?? false}
            />
          );
        })}
      </Box>

      {/* Footer bar */}
      <Box paddingX={1}>
        <Text dimColor>
          {chalk.bold('[q]')} quit  {chalk.bold('[a]')} add agent  {chalk.bold('[Tab]')} focus  {chalk.bold('[Enter]')} detail  {chalk.bold('[k]')} kill focused  {chalk.bold('[r]')} restart  {chalk.bold('[l]')} loop  {chalk.bold('[p]')} pause  {chalk.bold('[L]')} reset loop
        </Text>
      </Box>
    </Box>
  );
}
