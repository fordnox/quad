import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { spawn, type ChildProcess } from 'child_process';
import type { AgentConfig, AgentStatus, AgentType } from '../types/agent.js';
import { ParserPipeline, type ParsedOutput } from '../parsers/outputParser.js';
import { claudeParser } from '../parsers/claudeParser.js';
import { opencodeParser } from '../parsers/opencodeParser.js';
import { genericParser } from '../parsers/genericParser.js';

const MAX_OUTPUT_LINES = 200;

export function createPipelineForType(agentType: AgentType): ParserPipeline {
  switch (agentType) {
    case 'claude':
      return new ParserPipeline([claudeParser, genericParser]);
    case 'opencode':
      return new ParserPipeline([opencodeParser, genericParser]);
    case 'custom':
    default:
      return new ParserPipeline([genericParser]);
  }
}

export interface UseAgentProcessResult {
  output: string[];
  parsedOutput: ParsedOutput[];
  currentActivity: string | null;
  status: AgentStatus;
  pid: number | null;
  run: () => void;
  kill: () => void;
}

export function useAgentProcess(config: AgentConfig): UseAgentProcessResult {
  const [output, setOutput] = useState<string[]>([]);
  const [parsedOutput, setParsedOutput] = useState<ParsedOutput[]>([]);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [pid, setPid] = useState<number | null>(null);
  const childRef = useRef<ChildProcess | null>(null);
  const killedRef = useRef(false);

  const pipeline = useMemo(() => createPipelineForType(config.type), [config.type]);

  const appendOutput = useCallback((data: string) => {
    const lines = data.toString().split('\n').filter((line) => line.length > 0);
    if (lines.length === 0) return;

    const newParsed = lines.map((line) => pipeline.parseLine(line));

    // Update currentActivity from the most recent non-unknown parsed line
    const lastMeaningful = [...newParsed].reverse().find((p) => p.type !== 'unknown');
    if (lastMeaningful?.summary) {
      setCurrentActivity(lastMeaningful.summary);
    }

    setOutput((prev) => {
      const combined = [...prev, ...lines];
      return combined.slice(-MAX_OUTPUT_LINES);
    });

    setParsedOutput((prev) => {
      const combined = [...prev, ...newParsed];
      return combined.slice(-MAX_OUTPUT_LINES);
    });
  }, [pipeline]);

  const run = useCallback(() => {
    if (childRef.current) return;

    setStatus('running');
    setOutput([]);
    setParsedOutput([]);
    setCurrentActivity(null);
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

  return { output, parsedOutput, currentActivity, status, pid, run, kill };
}
