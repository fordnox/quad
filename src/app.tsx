import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { AgentRegistryProvider } from './store/AgentRegistryProvider.js';

render(
  <AgentRegistryProvider>
    <App />
  </AgentRegistryProvider>
);
