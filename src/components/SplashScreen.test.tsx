import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { SplashScreen } from './SplashScreen.js';
import { ConfigProvider } from '../config/ConfigProvider.js';
import { ThemeProvider } from '../utils/ThemeProvider.js';
import { DEFAULT_CONFIG } from '../config/schema.js';

function renderWithProviders(ui: React.ReactElement, theme: 'default' | 'minimal' | 'neon' = 'default') {
  const config = { ...DEFAULT_CONFIG, theme };
  return render(
    <ConfigProvider config={config}>
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    </ConfigProvider>
  );
}

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the splash text', () => {
    const onDone = vi.fn();
    const { lastFrame } = renderWithProviders(
      <SplashScreen onDone={onDone} />
    );
    const frame = lastFrame() ?? '';
    // BigText renders "QUAD" in block font — should contain something
    expect(frame.length).toBeGreaterThan(0);
  });

  it('renders the subtitle text', () => {
    const onDone = vi.fn();
    const { lastFrame } = renderWithProviders(
      <SplashScreen onDone={onDone} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Multi-Agent TUI Orchestrator');
  });

  it('calls onDone after the duration', () => {
    const onDone = vi.fn();
    renderWithProviders(
      <SplashScreen onDone={onDone} duration={1500} />
    );
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('does not call onDone before the duration', () => {
    const onDone = vi.fn();
    renderWithProviders(
      <SplashScreen onDone={onDone} duration={1500} />
    );
    vi.advanceTimersByTime(1000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('supports custom duration', () => {
    const onDone = vi.fn();
    renderWithProviders(
      <SplashScreen onDone={onDone} duration={500} />
    );
    vi.advanceTimersByTime(499);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledOnce();
  });
});
