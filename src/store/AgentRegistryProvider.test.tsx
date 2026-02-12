import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { AgentRegistryProvider, useAgentRegistry } from './AgentRegistryProvider.js';
import type { AgentConfig } from '../types/agent.js';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'test-1',
  name: 'Test Agent',
  type: 'custom',
  role: 'coder',
  command: 'echo hello',
  args: [],
  ...overrides,
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function TestConsumer({ action }: { action?: (registry: ReturnType<typeof useAgentRegistry>) => void }) {
  const registry = useAgentRegistry();

  React.useEffect(() => {
    if (action) {
      action(registry);
    }
  }, []); // Run action on mount only

  return (
    <Text>
      count:{registry.agents.length}
      {registry.agents.map((a) => ` name:${a.config.name} status:${a.status}`).join('')}
    </Text>
  );
}

describe('AgentRegistryProvider', () => {
  it('provides an empty registry by default', () => {
    const { lastFrame } = render(
      <AgentRegistryProvider>
        <TestConsumer />
      </AgentRegistryProvider>
    );
    expect(lastFrame()).toContain('count:0');
  });

  it('addAgent adds an agent to the registry', async () => {
    const config = makeConfig({ id: 'a1', name: 'Alpha' });
    const { lastFrame } = render(
      <AgentRegistryProvider>
        <TestConsumer action={(reg) => reg.addAgent(config)} />
      </AgentRegistryProvider>
    );
    await wait(50);
    const frame = lastFrame()!;
    expect(frame).toContain('count:1');
    expect(frame).toContain('name:Alpha');
    expect(frame).toContain('status:idle');
  });

  it('updateAgent updates agent state', async () => {
    function UpdateTest() {
      const registry = useAgentRegistry();
      const initRef = React.useRef(false);

      React.useEffect(() => {
        if (!initRef.current) {
          initRef.current = true;
          registry.addAgent(makeConfig({ id: 'a1', name: 'Alpha' }));
          setTimeout(() => {
            registry.updateAgent('a1', { status: 'running', pid: 999 });
          }, 30);
        }
      }, []);

      return (
        <Text>
          count:{registry.agents.length}
          {registry.agents.map((a) => ` status:${a.status} pid:${a.pid}`).join('')}
        </Text>
      );
    }

    const { lastFrame } = render(
      <AgentRegistryProvider>
        <UpdateTest />
      </AgentRegistryProvider>
    );
    await wait(100);
    const frame = lastFrame()!;
    expect(frame).toContain('status:running');
    expect(frame).toContain('pid:999');
  });

  it('removeAgent removes an agent from the registry', async () => {
    function RemoveTest() {
      const registry = useAgentRegistry();
      const initRef = React.useRef(false);

      React.useEffect(() => {
        if (!initRef.current) {
          initRef.current = true;
          registry.addAgent(makeConfig({ id: 'a1', name: 'Alpha' }));
          registry.addAgent(makeConfig({ id: 'a2', name: 'Beta' }));
          setTimeout(() => {
            registry.removeAgent('a1');
          }, 30);
        }
      }, []);

      return (
        <Text>
          count:{registry.agents.length}
          {registry.agents.map((a) => ` name:${a.config.name}`).join('')}
        </Text>
      );
    }

    const { lastFrame } = render(
      <AgentRegistryProvider>
        <RemoveTest />
      </AgentRegistryProvider>
    );
    await wait(100);
    const frame = lastFrame()!;
    expect(frame).toContain('count:1');
    expect(frame).toContain('name:Beta');
    expect(frame).not.toContain('name:Alpha');
  });

  it('getAgent retrieves a specific agent', async () => {
    function GetAgentTest() {
      const registry = useAgentRegistry();
      const [found, setFound] = React.useState('none');
      const initRef = React.useRef(false);

      React.useEffect(() => {
        if (!initRef.current) {
          initRef.current = true;
          registry.addAgent(makeConfig({ id: 'a1', name: 'Alpha' }));
        }
      }, []);

      // Read agent from the context's agents array once it's available
      React.useEffect(() => {
        if (registry.agents.length > 0) {
          const agent = registry.getAgent('a1');
          if (agent) {
            setFound(agent.config.name);
          }
        }
      }, [registry.agents, registry.getAgent]);

      return <Text>found:{found}</Text>;
    }

    const { lastFrame } = render(
      <AgentRegistryProvider>
        <GetAgentTest />
      </AgentRegistryProvider>
    );
    await wait(100);
    expect(lastFrame()).toContain('found:Alpha');
  });

  it('useAgentRegistry throws outside provider', () => {
    // Ink's render catches React errors. We test that the error frame contains the message.
    function OrphanConsumer() {
      useAgentRegistry();
      return <Text>should not render</Text>;
    }

    const { lastFrame } = render(<OrphanConsumer />);
    const frame = lastFrame()!;
    expect(frame).toContain('useAgentRegistry must be used within an AgentRegistryProvider');
  });
});
