import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { spawn, type ChildProcess } from 'child_process';
import type { AgentConfig, AgentStatus, AgentType } from '../types/agent.js';
import { ParserPipeline, type ParsedOutput } from '../parsers/outputParser.js';
import { claudeParser } from '../parsers/claudeParser.js';
import { opencodeParser } from '../parsers/opencodeParser.js';
import { genericParser } from '../parsers/genericParser.js';

const MAX_OUTPUT_LINES = 200;
const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 3000;

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
  restartCount: number;
  run: () => void;
  kill: () => void;
}

export interface UseAgentProcessOptions {
  autoRestart?: boolean;
}

export function useAgentProcess(config: AgentConfig, options: UseAgentProcessOptions = {}): UseAgentProcessResult {
  const { autoRestart = false } = options;
  const [output, setOutput] = useState<string[]>([]);
  const [parsedOutput, setParsedOutput] = useState<ParsedOutput[]>([]);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [pid, setPid] = useState<number | null>(null);
  const [restartCount, setRestartCount] = useState(0);
  const childRef = useRef<ChildProcess | null>(null);
  const killedRef = useRef(false);
  const restartCountRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

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

  const startProcess = useCallback(() => {
    if (childRef.current) return;

    setStatus('running');
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
      if (killedRef.current || unmountedRef.current) return;

      if (code !== 0) {
        // Check if we should auto-restart
        if (autoRestart && restartCountRef.current < MAX_RESTARTS) {
          restartCountRef.current++;
          setRestartCount(restartCountRef.current);
          appendOutput(`Process exited with code ${code}. Restarting in ${RESTART_DELAY_MS / 1000}s (${restartCountRef.current}/${MAX_RESTARTS})...`);
          setStatus('idle');

          restartTimerRef.current = setTimeout(() => {
            if (!unmountedRef.current && !killedRef.current) {
              startProcess();
            }
          }, RESTART_DELAY_MS);
          return;
        }
        setStatus('error');
      } else {
        setStatus('finished');
      }
    });

    child.on('error', (err) => {
      childRef.current = null;
      if (unmountedRef.current) return;

      appendOutput(`Error: ${err.message}`);

      // Check if we should auto-restart on spawn error too
      if (autoRestart && restartCountRef.current < MAX_RESTARTS) {
        restartCountRef.current++;
        setRestartCount(restartCountRef.current);
        appendOutput(`Restarting in ${RESTART_DELAY_MS / 1000}s (${restartCountRef.current}/${MAX_RESTARTS})...`);
        setStatus('idle');

        restartTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current && !killedRef.current) {
            startProcess();
          }
        }, RESTART_DELAY_MS);
        return;
      }
      setStatus('error');
    });
  }, [config.command, config.args, appendOutput, autoRestart]);

  const run = useCallback(() => {
    if (childRef.current) return;
    setOutput([]);
    setParsedOutput([]);
    setCurrentActivity(null);
    restartCountRef.current = 0;
    setRestartCount(0);
    startProcess();
  }, [startProcess]);

  const kill = useCallback(() => {
    // Cancel any pending restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
      killedRef.current = true;
      setStatus('finished');
    }

    if (childRef.current) {
      killedRef.current = true;
      childRef.current.kill('SIGTERM');
      childRef.current = null;
      setStatus('finished');
    }
  }, []);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;

      // Cancel any pending restart
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }

      if (childRef.current) {
        childRef.current.kill('SIGTERM');
        childRef.current = null;
      }
    };
  }, []);

  return { output, parsedOutput, currentActivity, status, pid, restartCount, run, kill };
}
