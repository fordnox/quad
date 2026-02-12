import React from 'react';
import { Box, Text } from 'ink';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    process.stderr.write(
      `[quad] React render error: ${error.message}\n${error.stack ?? ''}\nComponent stack: ${errorInfo.componentStack ?? 'unknown'}\n`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
          <Text bold color="red">QUAD — Render Error</Text>
          <Text> </Text>
          <Text color="red">
            {this.state.error?.message ?? 'An unexpected error occurred in the UI.'}
          </Text>
          <Text> </Text>
          <Text dimColor>The application encountered a rendering error.</Text>
          <Text dimColor>Check stderr for the full stack trace.</Text>
          <Text dimColor>Press Ctrl+C to exit.</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
