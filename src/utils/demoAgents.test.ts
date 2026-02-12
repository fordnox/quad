import { describe, it, expect } from 'vitest';
import {
  demoConfigs,
  claudeDemoScript,
  opencodeDemoScript,
  gitPushDemoScript,
} from './demoAgents.js';
import { ParserPipeline } from '../parsers/outputParser.js';
import { claudeParser } from '../parsers/claudeParser.js';
import { opencodeParser } from '../parsers/opencodeParser.js';
import { genericParser } from '../parsers/genericParser.js';
import { createPipelineForType } from '../hooks/useAgentProcess.js';

describe('demoAgents', () => {
  describe('demoConfigs', () => {
    it('exports exactly 3 demo agent configs', () => {
      expect(demoConfigs).toHaveLength(3);
    });

    it('has unique ids', () => {
      const ids = demoConfigs.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each config has required fields', () => {
      for (const config of demoConfigs) {
        expect(config.id).toBeTruthy();
        expect(config.name).toBeTruthy();
        expect(config.type).toBeTruthy();
        expect(config.role).toBeTruthy();
        expect(config.command).toBeTruthy();
        expect(Array.isArray(config.args)).toBe(true);
      }
    });

    it('includes a claude-type agent', () => {
      const claude = demoConfigs.find((c) => c.type === 'claude');
      expect(claude).toBeDefined();
      expect(claude!.id).toBe('demo-claude');
    });

    it('includes an opencode-type agent', () => {
      const opencode = demoConfigs.find((c) => c.type === 'opencode');
      expect(opencode).toBeDefined();
      expect(opencode!.id).toBe('demo-opencode');
    });

    it('includes a custom-type agent for git push', () => {
      const custom = demoConfigs.find((c) => c.type === 'custom');
      expect(custom).toBeDefined();
      expect(custom!.id).toBe('demo-gitpush');
    });

    it('commands start with bash -c', () => {
      for (const config of demoConfigs) {
        expect(config.command).toMatch(/^bash -c '/);
      }
    });
  });

  describe('claudeDemoScript', () => {
    it('has multiple steps', () => {
      expect(claudeDemoScript.length).toBeGreaterThan(5);
    });

    it('each step is a [delay, line] tuple', () => {
      for (const [delay, line] of claudeDemoScript) {
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      }
    });

    it('produces lines parseable by the claude pipeline', () => {
      const pipeline = createPipelineForType('claude');
      const lines = claudeDemoScript.map(([, line]) => line);
      const parsed = lines.map((line) => pipeline.parseLine(line));

      // Should have a mix of types, not all unknown
      const types = new Set(parsed.map((p) => p.type));
      expect(types.size).toBeGreaterThan(1);

      // Should include status, code, command, progress, and error types
      expect(types.has('status')).toBe(true);
      expect(types.has('code')).toBe(true);
      expect(types.has('progress')).toBe(true);
      expect(types.has('error')).toBe(true);
    });

    it('includes thinking/planning indicators (status type)', () => {
      const pipeline = createPipelineForType('claude');
      const lines = claudeDemoScript.map(([, line]) => line);
      const statusLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'status',
      );
      expect(statusLines.length).toBeGreaterThanOrEqual(2);
    });

    it('includes file edit indicators (code type)', () => {
      const pipeline = createPipelineForType('claude');
      const lines = claudeDemoScript.map(([, line]) => line);
      const codeLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'code',
      );
      expect(codeLines.length).toBeGreaterThanOrEqual(2);
    });

    it('includes command executions', () => {
      const pipeline = createPipelineForType('claude');
      const lines = claudeDemoScript.map(([, line]) => line);
      const commandLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'command',
      );
      expect(commandLines.length).toBeGreaterThanOrEqual(1);
    });

    it('includes progress markers with extractable progress data', () => {
      const pipeline = createPipelineForType('claude');
      const lines = claudeDemoScript.map(([, line]) => line);
      const progressLines = lines
        .map((line) => pipeline.parseLine(line))
        .filter((p) => p.type === 'progress' && p.progress !== null);
      expect(progressLines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('opencodeDemoScript', () => {
    it('has multiple steps', () => {
      expect(opencodeDemoScript.length).toBeGreaterThan(5);
    });

    it('each step is a [delay, line] tuple', () => {
      for (const [delay, line] of opencodeDemoScript) {
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      }
    });

    it('produces lines parseable by the opencode pipeline', () => {
      const pipeline = createPipelineForType('opencode');
      const lines = opencodeDemoScript.map(([, line]) => line);
      const parsed = lines.map((line) => pipeline.parseLine(line));

      const types = new Set(parsed.map((p) => p.type));
      expect(types.size).toBeGreaterThan(1);

      // Should include info (model/token lines), code, and progress types
      expect(types.has('info')).toBe(true);
      expect(types.has('progress')).toBe(true);
    });

    it('includes model/provider indicators (info type)', () => {
      const pipeline = createPipelineForType('opencode');
      const lines = opencodeDemoScript.map(([, line]) => line);
      const infoLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'info',
      );
      expect(infoLines.length).toBeGreaterThanOrEqual(2);
    });

    it('includes token/cost tracking lines', () => {
      const pipeline = createPipelineForType('opencode');
      const lines = opencodeDemoScript.map(([, line]) => line);
      const tokenCostLines = lines.filter((line) => {
        const parsed = pipeline.parseLine(line);
        return (
          parsed.type === 'info' &&
          (line.toLowerCase().includes('token') || line.toLowerCase().includes('cost'))
        );
      });
      expect(tokenCostLines.length).toBeGreaterThanOrEqual(2);
    });

    it('includes code change indicators', () => {
      const pipeline = createPipelineForType('opencode');
      const lines = opencodeDemoScript.map(([, line]) => line);
      const codeLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'code',
      );
      expect(codeLines.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('gitPushDemoScript', () => {
    it('has multiple steps', () => {
      expect(gitPushDemoScript.length).toBeGreaterThan(5);
    });

    it('each step is a [delay, line] tuple', () => {
      for (const [delay, line] of gitPushDemoScript) {
        expect(typeof delay).toBe('number');
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      }
    });

    it('produces lines parseable by the custom (generic) pipeline', () => {
      const pipeline = createPipelineForType('custom');
      const lines = gitPushDemoScript.map(([, line]) => line);
      const parsed = lines.map((line) => pipeline.parseLine(line));

      const types = new Set(parsed.map((p) => p.type));
      // Should have at least command and progress types
      expect(types.has('command')).toBe(true);
      expect(types.has('progress')).toBe(true);
    });

    it('includes git operation commands', () => {
      const pipeline = createPipelineForType('custom');
      const lines = gitPushDemoScript.map(([, line]) => line);
      const commandLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'command',
      );
      expect(commandLines.length).toBeGreaterThanOrEqual(3);
    });

    it('includes test result patterns (progress)', () => {
      const pipeline = createPipelineForType('custom');
      const lines = gitPushDemoScript.map(([, line]) => line);
      const progressLines = lines.filter(
        (line) => pipeline.parseLine(line).type === 'progress',
      );
      expect(progressLines.length).toBeGreaterThanOrEqual(2);
    });

    it('includes git add, commit, and push operations', () => {
      const lines = gitPushDemoScript.map(([, line]) => line);
      expect(lines.some((l) => l.includes('git add'))).toBe(true);
      expect(lines.some((l) => l.includes('git commit'))).toBe(true);
      expect(lines.some((l) => l.includes('git push'))).toBe(true);
    });
  });

  describe('all scripts produce meaningful currentActivity candidates', () => {
    it('claude script has lines that would update currentActivity', () => {
      const pipeline = createPipelineForType('claude');
      const lines = claudeDemoScript.map(([, line]) => line);
      const meaningfulLines = lines
        .map((line) => pipeline.parseLine(line))
        .filter((p) => p.type !== 'unknown' && p.summary);
      // Most lines should be parseable for the demo to be meaningful
      expect(meaningfulLines.length).toBeGreaterThan(lines.length / 2);
    });

    it('opencode script has lines that would update currentActivity', () => {
      const pipeline = createPipelineForType('opencode');
      const lines = opencodeDemoScript.map(([, line]) => line);
      const meaningfulLines = lines
        .map((line) => pipeline.parseLine(line))
        .filter((p) => p.type !== 'unknown' && p.summary);
      expect(meaningfulLines.length).toBeGreaterThan(lines.length / 2);
    });

    it('git push script has lines that would update currentActivity', () => {
      const pipeline = createPipelineForType('custom');
      const lines = gitPushDemoScript.map(([, line]) => line);
      const meaningfulLines = lines
        .map((line) => pipeline.parseLine(line))
        .filter((p) => p.type !== 'unknown' && p.summary);
      // Git push script has some plain text lines, so lower threshold
      expect(meaningfulLines.length).toBeGreaterThanOrEqual(5);
    });
  });
});
