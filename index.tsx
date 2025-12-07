
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GameConfig } from './types';

// Store the root to allow unmounting later
let appRoot: ReactDOM.Root | null = null;

const initTetrisBackground = (containerId: string, options?: Partial<GameConfig>) => {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`TetrisSDK: Container with ID "${containerId}" not found.`);
    return;
  }

  // Ensure relative positioning so the absolute canvas fits inside
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // Cleanup existing instance if any
  if (appRoot) {
    appRoot.unmount();
    appRoot = null;
  }

  appRoot = ReactDOM.createRoot(container);
  
  // In SDK mode, we default to 'live' mode (no UI), unless manually overridden via options or URL
  // But we pass the options down to the App
  appRoot.render(
    <React.StrictMode>
      <App initialConfigOverride={options} sdkMode={true} />
    </React.StrictMode>
  );
};

const destroyTetrisBackground = () => {
  if (appRoot) {
    appRoot.unmount();
    appRoot = null;
    // Also clean up the global API to prevent stale references
    // @ts-ignore
    window.TetrisFlow = undefined;
  }
};

// Expose the SDK to the window
window.TetrisSDK = {
  init: initTetrisBackground,
  destroy: destroyTetrisBackground,
  get api() {
    return window.TetrisFlow || null;
  }
};

// --- STANDALONE DEV MODE ---
// If we find the default root element AND we haven't been manually initialized yet,
// we assume this is the standalone dev environment.
const devRoot = document.getElementById('root');
if (devRoot && !window.TetrisFlow) {
  // Check if we are being embedded (e.g. inside an iframe or host that intentionally left #root empty)
  // For safety, we only auto-render if body has no other content or specific attribute logic could be added here.
  
  const root = ReactDOM.createRoot(devRoot);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  appRoot = root;
}
