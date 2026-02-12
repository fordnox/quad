import { useState, useCallback } from 'react';

export interface UseFocusResult {
  focusedAgentId: string | null;
  detailMode: boolean;
  focusNext: (agentIds: string[]) => void;
  focusPrev: (agentIds: string[]) => void;
  toggleDetail: () => void;
  clearFocus: () => void;
}

export function useFocus(): UseFocusResult {
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState(false);

  const focusNext = useCallback((agentIds: string[]) => {
    if (agentIds.length === 0) return;
    setFocusedAgentId((current) => {
      if (current === null) return agentIds[0]!;
      const idx = agentIds.indexOf(current);
      if (idx === -1) return agentIds[0]!;
      return agentIds[(idx + 1) % agentIds.length]!;
    });
  }, []);

  const focusPrev = useCallback((agentIds: string[]) => {
    if (agentIds.length === 0) return;
    setFocusedAgentId((current) => {
      if (current === null) return agentIds[agentIds.length - 1]!;
      const idx = agentIds.indexOf(current);
      if (idx === -1) return agentIds[agentIds.length - 1]!;
      return agentIds[(idx - 1 + agentIds.length) % agentIds.length]!;
    });
  }, []);

  const toggleDetail = useCallback(() => {
    setDetailMode((prev) => !prev);
  }, []);

  const clearFocus = useCallback(() => {
    setDetailMode(false);
    setFocusedAgentId(null);
  }, []);

  return {
    focusedAgentId,
    detailMode,
    focusNext,
    focusPrev,
    toggleDetail,
    clearFocus,
  };
}
