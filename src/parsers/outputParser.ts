export type ParsedOutputType = 'status' | 'code' | 'command' | 'error' | 'info' | 'progress' | 'unknown';

export interface ParsedOutput {
  raw: string;
  type: ParsedOutputType;
  summary: string | null;
  progress: { current: number; total: number } | null;
  timestamp: Date;
}

export interface OutputParser {
  name: string;
  canParse(line: string): boolean;
  parse(line: string): ParsedOutput;
}

export class ParserPipeline {
  private parsers: OutputParser[];

  constructor(parsers: OutputParser[]) {
    this.parsers = parsers;
  }

  parseLine(line: string): ParsedOutput {
    for (const parser of this.parsers) {
      if (parser.canParse(line)) {
        return parser.parse(line);
      }
    }

    // Fallback to unknown type
    return {
      raw: line,
      type: 'unknown',
      summary: null,
      progress: null,
      timestamp: new Date(),
    };
  }
}
