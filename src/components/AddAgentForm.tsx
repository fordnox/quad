import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import type { AgentType, AgentRole, AgentConfig } from '../types/agent.js';

export interface AddAgentFormProps {
  onSubmit: (config: AgentConfig) => void;
  onCancel: () => void;
  nextId: string;
}

type Step = 'type' | 'role' | 'name' | 'command';

const agentTypes: { value: AgentType; label: string; description: string }[] = [
  { value: 'claude', label: 'claude', description: 'Runs claude CLI' },
  { value: 'opencode', label: 'opencode', description: 'Runs opencode CLI' },
  { value: 'custom', label: 'custom', description: 'Enter a custom shell command' },
];

const agentRoles: { value: AgentRole; label: string }[] = [
  { value: 'coder', label: 'coder' },
  { value: 'auditor', label: 'auditor' },
  { value: 'planner', label: 'planner' },
  { value: 'reviewer', label: 'reviewer' },
];

const defaultCommands: Record<AgentType, string> = {
  claude: 'claude',
  opencode: 'opencode',
  custom: '',
};

export function AddAgentForm({ onSubmit, onCancel, nextId }: AddAgentFormProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<AgentType>('claude');
  const [typeIndex, setTypeIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('coder');
  const [roleIndex, setRoleIndex] = useState(0);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');

  const defaultName = `Agent-${nextId}`;

  const handleSubmitForm = useCallback(() => {
    const finalName = name.trim() || defaultName;
    const finalCommand = selectedType === 'custom' ? command : defaultCommands[selectedType];

    const config: AgentConfig = {
      id: `agent-${nextId}-${Date.now()}`,
      name: finalName,
      type: selectedType,
      role: selectedRole,
      command: finalCommand,
      args: [],
    };

    onSubmit(config);
  }, [name, defaultName, selectedType, command, nextId, selectedRole, onSubmit]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === 'type') {
      if (key.upArrow) {
        const newIndex = (typeIndex - 1 + agentTypes.length) % agentTypes.length;
        setTypeIndex(newIndex);
        setSelectedType(agentTypes[newIndex]!.value);
      } else if (key.downArrow) {
        const newIndex = (typeIndex + 1) % agentTypes.length;
        setTypeIndex(newIndex);
        setSelectedType(agentTypes[newIndex]!.value);
      } else if (key.return) {
        setStep('role');
      }
    } else if (step === 'role') {
      if (key.upArrow) {
        const newIndex = (roleIndex - 1 + agentRoles.length) % agentRoles.length;
        setRoleIndex(newIndex);
        setSelectedRole(agentRoles[newIndex]!.value);
      } else if (key.downArrow) {
        const newIndex = (roleIndex + 1) % agentRoles.length;
        setRoleIndex(newIndex);
        setSelectedRole(agentRoles[newIndex]!.value);
      } else if (key.return) {
        setStep('name');
      }
    }
    // 'name' and 'command' steps are handled by TextInput onSubmit
  });

  const handleNameSubmit = useCallback(() => {
    if (selectedType === 'custom') {
      setStep('command');
    } else {
      handleSubmitForm();
    }
  }, [selectedType, handleSubmitForm]);

  const handleCommandSubmit = useCallback(() => {
    handleSubmitForm();
  }, [handleSubmitForm]);

  const termWidth = process.stdout.columns || 80;
  const termHeight = process.stdout.rows || 24;
  const formWidth = Math.min(60, termWidth - 4);

  return (
    <Box
      flexDirection="column"
      width={termWidth}
      height={termHeight}
      alignItems="center"
      justifyContent="center"
    >
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        width={formWidth}
        paddingX={2}
        paddingY={1}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">Add New Agent</Text>
        </Box>

        {/* Step 1: Type selection */}
        <Box flexDirection="column" marginBottom={step === 'type' ? 1 : 0}>
          <Text bold color={step === 'type' ? 'white' : 'gray'}>
            1. Agent Type {step !== 'type' && chalk.green(`[${selectedType}]`)}
          </Text>
          {step === 'type' && (
            <Box flexDirection="column" marginLeft={2}>
              {agentTypes.map((t, i) => (
                <Text key={t.value}>
                  {i === typeIndex ? chalk.cyan('▸ ') : '  '}
                  <Text bold={i === typeIndex}>{t.label}</Text>
                  <Text dimColor> — {t.description}</Text>
                </Text>
              ))}
              <Text dimColor italic>
                {'\n'}↑/↓ to select, Enter to confirm
              </Text>
            </Box>
          )}
        </Box>

        {/* Step 2: Role selection */}
        {(step === 'role' || step === 'name' || step === 'command') && (
          <Box flexDirection="column" marginBottom={step === 'role' ? 1 : 0}>
            <Text bold color={step === 'role' ? 'white' : 'gray'}>
              2. Role {step !== 'role' && chalk.green(`[${selectedRole}]`)}
            </Text>
            {step === 'role' && (
              <Box flexDirection="column" marginLeft={2}>
                {agentRoles.map((r, i) => (
                  <Text key={r.value}>
                    {i === roleIndex ? chalk.cyan('▸ ') : '  '}
                    <Text bold={i === roleIndex}>{r.label}</Text>
                  </Text>
                ))}
                <Text dimColor italic>
                  {'\n'}↑/↓ to select, Enter to confirm
                </Text>
              </Box>
            )}
          </Box>
        )}

        {/* Step 3: Name input */}
        {(step === 'name' || step === 'command') && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={step === 'name' ? 'white' : 'gray'}>
              3. Name {step !== 'name' && chalk.green(`[${name || defaultName}]`)}
            </Text>
            {step === 'name' && (
              <Box marginLeft={2}>
                <Text>{'> '}</Text>
                <TextInput
                  value={name}
                  onChange={setName}
                  onSubmit={handleNameSubmit}
                  placeholder={defaultName}
                  focus={step === 'name'}
                />
              </Box>
            )}
          </Box>
        )}

        {/* Step 4: Command input (custom type only) */}
        {step === 'command' && (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color="white">
              4. Shell Command
            </Text>
            <Box marginLeft={2}>
              <Text>{'> '}</Text>
              <TextInput
                value={command}
                onChange={setCommand}
                onSubmit={handleCommandSubmit}
                placeholder="e.g. bash -c 'echo hello'"
                focus={step === 'command'}
              />
            </Box>
          </Box>
        )}

        {/* Footer hint */}
        <Box marginTop={1}>
          <Text dimColor>
            {chalk.bold('[Escape]')} cancel
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
