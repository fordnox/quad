import { describe, it, expect } from 'vitest';
import { createPipelineForType } from './useAgentProcess.js';

describe('createPipelineForType', () => {
  it('creates a pipeline for claude type that recognizes claude-specific patterns', () => {
    const pipeline = createPipelineForType('claude');
    const result = pipeline.parseLine('Thinking about the problem...');
    expect(result.type).toBe('status');
    expect(result.summary).toBeTruthy();
  });

  it('claude pipeline detects tool usage (info type)', () => {
    const pipeline = createPipelineForType('claude');
    const result = pipeline.parseLine('Read file src/app.ts');
    expect(result.type).toBe('info');
    expect(result.summary).toContain('Tool: Read');
  });

  it('claude pipeline falls back to generic parser for git commands', () => {
    const pipeline = createPipelineForType('claude');
    const result = pipeline.parseLine('git commit -m "fix bug"');
    expect(result.type).toBe('command');
  });

  it('creates a pipeline for opencode type that recognizes model info', () => {
    const pipeline = createPipelineForType('opencode');
    const result = pipeline.parseLine('Using gpt-4 for code generation');
    expect(result.type).toBe('info');
    expect(result.summary).toContain('gpt-4');
  });

  it('opencode pipeline detects token tracking', () => {
    const pipeline = createPipelineForType('opencode');
    const result = pipeline.parseLine('Tokens used: 1500');
    expect(result.type).toBe('info');
  });

  it('opencode pipeline detects file path patterns in test output', () => {
    const pipeline = createPipelineForType('opencode');
    // OpenCode parser detects .test.ts as a file path (code type) before generic parser
    const result = pipeline.parseLine('PASS src/app.test.ts');
    expect(result.type).toBe('code');
  });

  it('opencode pipeline falls back to generic parser for PASS without file path', () => {
    const pipeline = createPipelineForType('opencode');
    const result = pipeline.parseLine('PASS all tests completed');
    expect(result.type).toBe('progress');
  });

  it('creates a pipeline for custom type with only generic parser', () => {
    const pipeline = createPipelineForType('custom');
    // Claude-specific tool usage should NOT be detected by generic parser
    const result = pipeline.parseLine('Read file src/app.ts');
    // Generic parser doesn't have tool patterns, so this should be unknown
    expect(result.type).toBe('unknown');
  });

  it('custom pipeline detects generic patterns like git operations', () => {
    const pipeline = createPipelineForType('custom');
    const result = pipeline.parseLine('git push origin main');
    expect(result.type).toBe('command');
  });

  it('custom pipeline detects test runner patterns', () => {
    const pipeline = createPipelineForType('custom');
    const result = pipeline.parseLine('✓ should pass test');
    expect(result.type).toBe('progress');
  });

  it('returns unknown type for unrecognized lines', () => {
    const pipeline = createPipelineForType('custom');
    const result = pipeline.parseLine('some random text output');
    expect(result.type).toBe('unknown');
  });

  it('extracts progress data from bracket patterns', () => {
    const pipeline = createPipelineForType('claude');
    const result = pipeline.parseLine('[3/10] Processing files...');
    expect(result.type).toBe('progress');
    expect(result.progress).toEqual({ current: 3, total: 10 });
    expect(result.summary).toBe('Step 3 of 10');
  });

  it('detects errors in claude and opencode pipelines', () => {
    for (const type of ['claude', 'opencode'] as const) {
      const pipeline = createPipelineForType(type);
      const result = pipeline.parseLine('Error: something went wrong');
      expect(result.type).toBe('error');
    }
  });

  it('custom pipeline does not detect errors (generic parser has no error patterns)', () => {
    const pipeline = createPipelineForType('custom');
    const result = pipeline.parseLine('Error: something went wrong');
    // Generic parser doesn't have error patterns, so this is unknown
    expect(result.type).toBe('unknown');
  });

  it('preserves raw line in parsed output', () => {
    const pipeline = createPipelineForType('claude');
    const raw = 'Thinking about the architecture...';
    const result = pipeline.parseLine(raw);
    expect(result.raw).toBe(raw);
  });

  it('sets timestamp on parsed output', () => {
    const pipeline = createPipelineForType('claude');
    const before = new Date();
    const result = pipeline.parseLine('Analyzing code...');
    const after = new Date();
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
