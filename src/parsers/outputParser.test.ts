import { describe, it, expect } from 'vitest';
import { ParserPipeline, type OutputParser, type ParsedOutput } from './outputParser.js';

function makeParser(overrides: Partial<OutputParser> & { name: string }): OutputParser {
  return {
    canParse: () => false,
    parse: (line: string) => ({
      raw: line,
      type: 'unknown',
      summary: null,
      progress: null,
      timestamp: new Date(),
    }),
    ...overrides,
  };
}

describe('ParserPipeline', () => {
  it('returns unknown type when no parsers match', () => {
    const pipeline = new ParserPipeline([]);
    const result = pipeline.parseLine('some output');
    expect(result.type).toBe('unknown');
    expect(result.raw).toBe('some output');
    expect(result.summary).toBeNull();
    expect(result.progress).toBeNull();
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('returns result from the first matching parser', () => {
    const parserA = makeParser({
      name: 'parser-a',
      canParse: (line) => line.includes('hello'),
      parse: (line) => ({
        raw: line,
        type: 'status',
        summary: 'Hello detected',
        progress: null,
        timestamp: new Date(),
      }),
    });
    const parserB = makeParser({
      name: 'parser-b',
      canParse: (line) => line.includes('hello'),
      parse: (line) => ({
        raw: line,
        type: 'error',
        summary: 'Should not reach here',
        progress: null,
        timestamp: new Date(),
      }),
    });

    const pipeline = new ParserPipeline([parserA, parserB]);
    const result = pipeline.parseLine('hello world');
    expect(result.type).toBe('status');
    expect(result.summary).toBe('Hello detected');
  });

  it('skips parsers that do not match and finds one that does', () => {
    const parserA = makeParser({
      name: 'parser-a',
      canParse: () => false,
    });
    const parserB = makeParser({
      name: 'parser-b',
      canParse: (line) => line.includes('error'),
      parse: (line) => ({
        raw: line,
        type: 'error',
        summary: 'Error found',
        progress: null,
        timestamp: new Date(),
      }),
    });

    const pipeline = new ParserPipeline([parserA, parserB]);
    const result = pipeline.parseLine('an error occurred');
    expect(result.type).toBe('error');
    expect(result.summary).toBe('Error found');
  });

  it('falls back to unknown when all parsers reject the line', () => {
    const parserA = makeParser({ name: 'a', canParse: () => false });
    const parserB = makeParser({ name: 'b', canParse: () => false });

    const pipeline = new ParserPipeline([parserA, parserB]);
    const result = pipeline.parseLine('unrecognized line');
    expect(result.type).toBe('unknown');
    expect(result.raw).toBe('unrecognized line');
  });

  it('preserves the raw field from the original line', () => {
    const parser = makeParser({
      name: 'raw-check',
      canParse: () => true,
      parse: (line) => ({
        raw: line,
        type: 'info',
        summary: 'matched',
        progress: null,
        timestamp: new Date(),
      }),
    });

    const pipeline = new ParserPipeline([parser]);
    const result = pipeline.parseLine('exact original line');
    expect(result.raw).toBe('exact original line');
  });

  it('handles progress data from parsers', () => {
    const parser = makeParser({
      name: 'progress-parser',
      canParse: () => true,
      parse: (line) => ({
        raw: line,
        type: 'progress',
        summary: 'Step 3 of 10',
        progress: { current: 3, total: 10 },
        timestamp: new Date(),
      }),
    });

    const pipeline = new ParserPipeline([parser]);
    const result = pipeline.parseLine('[3/10] Processing');
    expect(result.type).toBe('progress');
    expect(result.progress).toEqual({ current: 3, total: 10 });
    expect(result.summary).toBe('Step 3 of 10');
  });

  it('uses parser order to determine priority', () => {
    const lowPriority = makeParser({
      name: 'low',
      canParse: () => true,
      parse: (line) => ({
        raw: line,
        type: 'unknown',
        summary: 'low priority',
        progress: null,
        timestamp: new Date(),
      }),
    });
    const highPriority = makeParser({
      name: 'high',
      canParse: () => true,
      parse: (line) => ({
        raw: line,
        type: 'status',
        summary: 'high priority',
        progress: null,
        timestamp: new Date(),
      }),
    });

    // High priority first
    const pipeline = new ParserPipeline([highPriority, lowPriority]);
    const result = pipeline.parseLine('test');
    expect(result.summary).toBe('high priority');
  });
});
