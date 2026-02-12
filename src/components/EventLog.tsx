import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { LogEntry } from '../store/eventLog.js';
import { getRecentLogs, onLogEntry } from '../store/eventLog.js';
import { useTheme } from '../utils/ThemeProvider.js';
import type { ThemeColors, ThemeInkColors } from '../utils/theme.js';

export interface EventLogProps {
  /** Whether the event log panel is visible. */
  visible: boolean;
  /** Maximum number of lines to display. */
  maxLines?: number;
}

function formatTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function colorForLevel(level: LogEntry['level'], ink: ThemeInkColors): string {
  switch (level) {
    case 'info':
      return 'white';
    case 'warn':
      return ink.loopPaused;
    case 'error':
      return ink.agentError;
  }
}

function levelTag(level: LogEntry['level'], t: ThemeColors): string {
  switch (level) {
    case 'info':
      return t.logInfo('INF');
    case 'warn':
      return t.logWarn('WRN');
    case 'error':
      return t.logError('ERR');
  }
}

export function EventLog({ visible, maxLines = 12 }: EventLogProps) {
  const { colors: t, ink } = useTheme();
  const [entries, setEntries] = useState<LogEntry[]>(() => getRecentLogs());
  const [scrollOffset, setScrollOffset] = useState(0);

  // Subscribe to new entries
  useEffect(() => {
    const unsub = onLogEntry(() => {
      setEntries(getRecentLogs());
      // Auto-scroll to bottom when new entries arrive (if already at bottom)
      setScrollOffset(0);
    });
    return unsub;
  }, []);

  // Handle scrolling with Up/Down keys when the panel is visible
  useInput(
    (input, key) => {
      if (key.upArrow) {
        setScrollOffset((prev) => Math.min(prev + 1, Math.max(0, entries.length - maxLines)));
      }
      if (key.downArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      }
    },
    { isActive: visible },
  );

  if (!visible) return null;

  // Calculate visible window: scrollOffset=0 means the latest entries are shown
  const visibleEntries = scrollOffset === 0
    ? entries.slice(-maxLines)
    : entries.slice(
        Math.max(0, entries.length - maxLines - scrollOffset),
        entries.length - scrollOffset,
      );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={ink.border}
      paddingX={1}
      marginTop={1}
    >
      <Box>
        <Text bold>
          {t.accent('Event Log')} <Text dimColor>({entries.length} entries — ↑/↓ to scroll, [e] to close)</Text>
        </Text>
      </Box>

      {visibleEntries.length === 0 ? (
        <Text dimColor>No events recorded yet.</Text>
      ) : (
        visibleEntries.map((entry, i) => (
          <Box key={i} gap={1}>
            <Text dimColor>{formatTimestamp(entry.timestamp)}</Text>
            <Text>{levelTag(entry.level, t)}</Text>
            <Text color={ink.accent}>{entry.source}</Text>
            <Text color={colorForLevel(entry.level, ink)}>{entry.message}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
