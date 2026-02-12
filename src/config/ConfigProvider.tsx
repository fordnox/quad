import React, { createContext, useContext } from 'react';
import type { QuadConfig } from './schema.js';
import { DEFAULT_CONFIG } from './schema.js';

const ConfigContext = createContext<QuadConfig>(DEFAULT_CONFIG);

export interface ConfigProviderProps {
  config: QuadConfig;
  children: React.ReactNode;
}

export function ConfigProvider({ config, children }: ConfigProviderProps) {
  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): QuadConfig {
  return useContext(ConfigContext);
}
