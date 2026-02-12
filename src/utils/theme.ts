import chalk, { type ChalkInstance } from 'chalk';
import type { ThemeName } from '../config/schema.js';

/**
 * Semantic color mapping for all themed UI elements.
 * Each property maps to a chalk color function.
 */
export interface ThemeColors {
  // Agent status
  agentIdle: ChalkInstance;
  agentRunning: ChalkInstance;
  agentFinished: ChalkInstance;
  agentError: ChalkInstance;

  // Agent type badges
  typeClaude: ChalkInstance;
  typeOpencode: ChalkInstance;
  typeCustom: ChalkInstance;

  // Agent role badges
  roleCoder: ChalkInstance;
  roleAuditor: ChalkInstance;
  rolePlanner: ChalkInstance;
  roleReviewer: ChalkInstance;
  roleCustom: ChalkInstance;

  // Loop phases
  phasePlan: ChalkInstance;
  phaseCode: ChalkInstance;
  phaseAudit: ChalkInstance;
  phasePush: ChalkInstance;
  phaseActive: ChalkInstance;

  // Loop status
  loopRunning: ChalkInstance;
  loopPaused: ChalkInstance;
  loopIdle: ChalkInstance;
  loopError: ChalkInstance;

  // Output types
  outputError: ChalkInstance;
  outputCommand: ChalkInstance;
  outputCode: ChalkInstance;
  outputProgress: ChalkInstance;
  outputStatus: ChalkInstance;
  outputInfo: ChalkInstance;
  outputUnknown: ChalkInstance;

  // Event log levels
  logInfo: ChalkInstance;
  logWarn: ChalkInstance;
  logError: ChalkInstance;

  // UI elements
  title: ChalkInstance;
  subtitle: ChalkInstance;
  accent: ChalkInstance;
  border: ChalkInstance;
  borderFocused: ChalkInstance;
  separator: ChalkInstance;
  hint: ChalkInstance;
  hintKey: ChalkInstance;
  dim: ChalkInstance;
  activity: ChalkInstance;
  success: ChalkInstance;

  // Header
  headerTitle: ChalkInstance;
  headerView: ChalkInstance;
}

/**
 * Ink-compatible border/text color names for each semantic purpose.
 * Used for Ink `color` and `borderColor` props (which accept color names, not chalk).
 */
export interface ThemeInkColors {
  agentIdle: string;
  agentRunning: string;
  agentFinished: string;
  agentError: string;
  borderFocused: string;
  loopRunning: string;
  loopPaused: string;
  loopIdle: string;
  loopError: string;
  border: string;
  accent: string;
  activity: string;
  success: string;
}

/** Default theme: professional blues and grays */
const defaultTheme: ThemeColors = {
  agentIdle: chalk.gray,
  agentRunning: chalk.green,
  agentFinished: chalk.blue,
  agentError: chalk.red,

  typeClaude: chalk.magenta,
  typeOpencode: chalk.cyan,
  typeCustom: chalk.yellow,

  roleCoder: chalk.green,
  roleAuditor: chalk.blue,
  rolePlanner: chalk.yellow,
  roleReviewer: chalk.cyan,
  roleCustom: chalk.white,

  phasePlan: chalk.yellow,
  phaseCode: chalk.green,
  phaseAudit: chalk.blue,
  phasePush: chalk.magenta,
  phaseActive: chalk.bold,

  loopRunning: chalk.green,
  loopPaused: chalk.yellow,
  loopIdle: chalk.gray,
  loopError: chalk.red,

  outputError: chalk.red,
  outputCommand: chalk.green,
  outputCode: chalk.blue,
  outputProgress: chalk.yellow,
  outputStatus: chalk.cyan,
  outputInfo: chalk.white,
  outputUnknown: chalk.dim,

  logInfo: chalk.white,
  logWarn: chalk.yellow,
  logError: chalk.red,

  title: chalk.white.bold,
  subtitle: chalk.cyan,
  accent: chalk.cyan,
  border: chalk.gray,
  borderFocused: chalk.yellow,
  separator: chalk.dim,
  hint: chalk.dim,
  hintKey: chalk.bold,
  dim: chalk.dim,
  activity: chalk.cyan.bold,
  success: chalk.green,

  headerTitle: chalk.white,
  headerView: chalk.cyan,
};

const defaultInk: ThemeInkColors = {
  agentIdle: 'gray',
  agentRunning: 'green',
  agentFinished: 'blue',
  agentError: 'red',
  borderFocused: 'yellow',
  loopRunning: 'green',
  loopPaused: 'yellow',
  loopIdle: 'gray',
  loopError: 'red',
  border: 'gray',
  accent: 'cyan',
  activity: 'cyan',
  success: 'green',
};

/** Minimal theme: monochrome with subtle accents */
const minimalTheme: ThemeColors = {
  agentIdle: chalk.gray,
  agentRunning: chalk.white,
  agentFinished: chalk.gray,
  agentError: chalk.red,

  typeClaude: chalk.white,
  typeOpencode: chalk.white,
  typeCustom: chalk.white,

  roleCoder: chalk.white,
  roleAuditor: chalk.white,
  rolePlanner: chalk.white,
  roleReviewer: chalk.white,
  roleCustom: chalk.white,

  phasePlan: chalk.white,
  phaseCode: chalk.white,
  phaseAudit: chalk.white,
  phasePush: chalk.white,
  phaseActive: chalk.bold,

  loopRunning: chalk.white,
  loopPaused: chalk.gray,
  loopIdle: chalk.gray,
  loopError: chalk.red,

  outputError: chalk.red,
  outputCommand: chalk.white,
  outputCode: chalk.white,
  outputProgress: chalk.white,
  outputStatus: chalk.gray,
  outputInfo: chalk.white,
  outputUnknown: chalk.dim,

  logInfo: chalk.white,
  logWarn: chalk.yellow,
  logError: chalk.red,

  title: chalk.white.bold,
  subtitle: chalk.white,
  accent: chalk.white,
  border: chalk.gray,
  borderFocused: chalk.white,
  separator: chalk.dim,
  hint: chalk.dim,
  hintKey: chalk.bold,
  dim: chalk.dim,
  activity: chalk.white.bold,
  success: chalk.white,

  headerTitle: chalk.white,
  headerView: chalk.white,
};

const minimalInk: ThemeInkColors = {
  agentIdle: 'gray',
  agentRunning: 'white',
  agentFinished: 'gray',
  agentError: 'red',
  borderFocused: 'white',
  loopRunning: 'white',
  loopPaused: 'gray',
  loopIdle: 'gray',
  loopError: 'red',
  border: 'gray',
  accent: 'white',
  activity: 'white',
  success: 'white',
};

/** Neon theme: vibrant greens, magentas, cyans (cyberpunk aesthetic) */
const neonTheme: ThemeColors = {
  agentIdle: chalk.hex('#666666'),
  agentRunning: chalk.hex('#39FF14'),
  agentFinished: chalk.hex('#00FFFF'),
  agentError: chalk.hex('#FF0040'),

  typeClaude: chalk.hex('#FF00FF'),
  typeOpencode: chalk.hex('#00FFFF'),
  typeCustom: chalk.hex('#FFFF00'),

  roleCoder: chalk.hex('#39FF14'),
  roleAuditor: chalk.hex('#00FFFF'),
  rolePlanner: chalk.hex('#FFFF00'),
  roleReviewer: chalk.hex('#FF00FF'),
  roleCustom: chalk.hex('#FFFFFF'),

  phasePlan: chalk.hex('#FFFF00'),
  phaseCode: chalk.hex('#39FF14'),
  phaseAudit: chalk.hex('#00FFFF'),
  phasePush: chalk.hex('#FF00FF'),
  phaseActive: chalk.bold,

  loopRunning: chalk.hex('#39FF14'),
  loopPaused: chalk.hex('#FFFF00'),
  loopIdle: chalk.hex('#666666'),
  loopError: chalk.hex('#FF0040'),

  outputError: chalk.hex('#FF0040'),
  outputCommand: chalk.hex('#39FF14'),
  outputCode: chalk.hex('#00FFFF'),
  outputProgress: chalk.hex('#FFFF00'),
  outputStatus: chalk.hex('#FF00FF'),
  outputInfo: chalk.hex('#FFFFFF'),
  outputUnknown: chalk.hex('#666666'),

  logInfo: chalk.hex('#FFFFFF'),
  logWarn: chalk.hex('#FFFF00'),
  logError: chalk.hex('#FF0040'),

  title: chalk.hex('#FF00FF').bold,
  subtitle: chalk.hex('#00FFFF'),
  accent: chalk.hex('#FF00FF'),
  border: chalk.hex('#333333'),
  borderFocused: chalk.hex('#FF00FF'),
  separator: chalk.hex('#333333'),
  hint: chalk.hex('#666666'),
  hintKey: chalk.hex('#00FFFF').bold,
  dim: chalk.hex('#666666'),
  activity: chalk.hex('#00FFFF').bold,
  success: chalk.hex('#39FF14'),

  headerTitle: chalk.hex('#FF00FF'),
  headerView: chalk.hex('#00FFFF'),
};

const neonInk: ThemeInkColors = {
  agentIdle: 'gray',
  agentRunning: 'greenBright',
  agentFinished: 'cyanBright',
  agentError: 'redBright',
  borderFocused: 'magentaBright',
  loopRunning: 'greenBright',
  loopPaused: 'yellowBright',
  loopIdle: 'gray',
  loopError: 'redBright',
  border: 'gray',
  accent: 'magentaBright',
  activity: 'cyanBright',
  success: 'greenBright',
};

const themes: Record<ThemeName, { colors: ThemeColors; ink: ThemeInkColors }> = {
  default: { colors: defaultTheme, ink: defaultInk },
  minimal: { colors: minimalTheme, ink: minimalInk },
  neon: { colors: neonTheme, ink: neonInk },
};

/**
 * Get the chalk-based theme colors for a given theme name.
 * Falls back to 'default' for unknown names.
 */
export function getTheme(name: string): ThemeColors {
  return themes[name as ThemeName]?.colors ?? defaultTheme;
}

/**
 * Get the Ink-compatible color names for a given theme name.
 * Falls back to 'default' for unknown names.
 */
export function getInkTheme(name: string): ThemeInkColors {
  return themes[name as ThemeName]?.ink ?? defaultInk;
}
