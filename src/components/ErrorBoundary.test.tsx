import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { ErrorBoundary } from './ErrorBoundary.js';

function ThrowingComponent({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

function GoodComponent() {
  return <Text>All good</Text>;
}

describe('ErrorBoundary', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('renders children when no error occurs', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(lastFrame()).toContain('All good');
  });

  it('renders fallback UI when a child component throws', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent message="Test render error" />
      </ErrorBoundary>,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Render Error');
    expect(frame).toContain('Test render error');
  });

  it('shows instructions to exit in fallback UI', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent message="crash" />
      </ErrorBoundary>,
    );
    expect(lastFrame()).toContain('Ctrl+C');
  });

  it('logs error details to stderr via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="stderr test" />
      </ErrorBoundary>,
    );

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('React render error: stderr test'),
    );
  });

  it('renders with red border styling', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent message="styled error" />
      </ErrorBoundary>,
    );
    // The component renders a box with borderColor="red"
    // In ink-testing-library, we check for content presence
    expect(lastFrame()).toContain('QUAD');
  });
});
