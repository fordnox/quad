import { useState, useCallback, useEffect, useRef } from 'react';
import { spawn, type ChildProcess } from 'child_process';
import type { AgentConfig, AgentStatus } from '../types/agent.js';

const MAX_OUTPUT_LINES = 20;

export interface UseAgentProcessResult {
  output: string[];
  status: AgentStatus;
  pid: number | null;
  run: () => void;
  kill: () => void;
}

export function useAgentProcess(config: AgentConfig): UseAgentProcessResult {
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [pid, setPid] = useState<number | null>(null);
  const childRef = useRef<ChildProcess | null>(null);
  const killedRef = useRef(false);

  const appendOutput = useCallback((data: string) => {
    const lines = data.toString().split('\n').filter((line) => line.length > 0);
    if (lines.length === 0) return;
    setOutput((prev) => {
      const combined = [...prev, ...lines];
      return combined.slice(-MAX_OUTPUT_LINES);
    });
  }, []);

  const run = useCallback(() => {
    if (childRef.current) return;

    setStatus('running');
    setOutput([]);
    killedRef.current = false;

    const child = spawn(config.command, config.args, { shell: true });
    childRef.current = child;
    setPid(child.pid ?? null);

    child.stdout?.on('data', (data: Buffer) => {
      appendOutput(data.toString());
    });

    child.stderr?.on('data', (data: Buffer) => {
      appendOutput(data.toString());
    });

    child.on('close', (code) => {
      childRef.current = null;
      if (killedRef.current) return;
      setStatus(code === 0 ? 'finished' : 'error');
    });

    child.on('error', (err) => {
      childRef.current = null;
      setStatus('error');
      appendOutput(`Error: ${err.message}`);
    });
  }, [config.command, config.args, appendOutput]);

  const kill = useCallback(() => {
    if (childRef.current) {
      killedRef.current = true;
      childRef.current.kill('SIGTERM');
      childRef.current = null;
      setStatus('finished');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (childRef.current) {
        childRef.current.kill('SIGTERM');
        childRef.current = null;
      }
    };
  }, []);

  return { output, status, pid, run, kill };
}
