
import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from './logic/SceneManager';
import { GameConfig, DEFAULT_ROWS, DEFAULT_COLS, AppMode, TetrisEventType, MusicSyncParams } from './types';
import { Controls } from './components/Controls';
import { PresetManager } from './logic/PresetManager';

// --- CONFIGURATION RANGES ---
// Modify these values to constrain the music sync logic
const RANGES = {
  FLOW_SPEED: [1, 4],     // Controlled by 'density'
  TEMPERATURE: [0, 1],    // Controlled by 'brightness'
  BPM: [60, 600]          // Controlled by 'expectedDuration'
};

// Coefficient for estimating BPM based on duration.
// Formula: BPM = (Rows * Cols * COEFF) / DurationSeconds
// Increase this if the game finishes too slowly. Decrease if it finishes too fast.
const BPM_FILL_COEFFICIENT = 40; 

interface AppProps {
  initialConfigOverride?: Partial<GameConfig>;
  sdkMode?: boolean;
}

const App: React.FC<AppProps> = ({ initialConfigOverride, sdkMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  
  // Event Listeners Storage: { 'reset': [cb1, cb2], 'lineClear': [] }
  const eventListenersRef = useRef<Record<string, (() => void)[]>>({});

  // If in SDK mode, default to 'live', otherwise 'debug'
  const [mode, setMode] = useState<AppMode>(sdkMode ? 'live' : 'debug');

  const [config, setConfig] = useState<GameConfig>({
    // --- USER REQUESTED PRESETS ---
    bpm: 60,
    temperature: 0.36,
    bloomStrength: 0.9,
    opacity: 0.15,
    gridVisible: true,
    fogDensity: 0,
    gridRows: 18,
    gridCols: 20,
    minLinesToClear: 1,
    enableLineClear: false,
    cameraMode: "manual",
    rotationSpeed: 0.5,
    cameraX: 0,
    cameraY: 10,
    cameraZ: 22,
    visualStyle: "matrix",
    flowSpeed: 3.5,
    customGrid: [],
    blockRoughness: 0.1,
    blockMetalness: 0.5,
    blockTransmission: 0.2,
    blockThickness: 1,
    environmentDimming: 0,

    // Apply overrides if any
    ...initialConfigOverride
  });

  // Check URL params for mode on mount (overrides everything)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'live') {
      setMode('live');
    } else if (urlMode === 'debug') {
      setMode('debug');
    }
  }, []);

  // Expose Global API for external control (OBS, Stream Deck, Console)
  useEffect(() => {
    window.TetrisFlow = {
      set: (key: keyof GameConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
      },
      setMode: (m: AppMode) => {
        setMode(m);
      },
      loadPreset: (name: string) => {
        const p = PresetManager.load(name);
        if (p) setConfig(p);
      },
      getPresets: () => PresetManager.list(),
      bulkUpdate: (updates: Partial<GameConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
      },
      toggle: (key: keyof GameConfig) => {
        setConfig(prev => ({ ...prev, [key]: !prev[key as keyof GameConfig] }));
      },
      
      // --- MUSIC SYNC INTERFACE ---
      syncMusic: (params: MusicSyncParams) => {
        const { density, brightness, expectedDuration } = params;

        // 1. Map Density -> Flow Speed
        // Clamp density 0-1
        const d = Math.max(0, Math.min(1, density));
        const newFlowSpeed = RANGES.FLOW_SPEED[0] + d * (RANGES.FLOW_SPEED[1] - RANGES.FLOW_SPEED[0]);

        // 2. Map Brightness -> Temperature
        // Clamp brightness 0-1
        const b = Math.max(0, Math.min(1, brightness));
        const newTemp = RANGES.TEMPERATURE[0] + b * (RANGES.TEMPERATURE[1] - RANGES.TEMPERATURE[0]);

        // 3. Map Duration -> BPM
        // Estimate: To fill a board of Size (Rows * Cols), we need a certain speed.
        // If duration is 0 or missing, default to current BPM or mid range.
        let newBpm = 60;
        if (expectedDuration && expectedDuration > 0) {
           // Heuristic formula
           const totalSlots = config.gridRows * config.gridCols;
           const calculatedBpm = (totalSlots * BPM_FILL_COEFFICIENT) / expectedDuration;
           newBpm = Math.max(RANGES.BPM[0], Math.min(RANGES.BPM[1], calculatedBpm));
        } else {
           newBpm = config.bpm;
        }

        setConfig(prev => ({
          ...prev,
          flowSpeed: parseFloat(newFlowSpeed.toFixed(2)),
          temperature: parseFloat(newTemp.toFixed(2)),
          bpm: Math.floor(newBpm)
        }));
      },

      on: (event: TetrisEventType, callback: () => void) => {
        if (!eventListenersRef.current[event]) {
          eventListenersRef.current[event] = [];
        }
        eventListenersRef.current[event].push(callback);
      },
      off: (event: TetrisEventType, callback: () => void) => {
        if (eventListenersRef.current[event]) {
           eventListenersRef.current[event] = eventListenersRef.current[event].filter(cb => cb !== callback);
        }
      }
    };

    // Cleanup on unmount
    return () => {
    };
  }, [config.gridRows, config.gridCols, config.bpm]); // Re-bind if dimensions change to keep calc accurate

  // Internal handler called by SceneManager
  const handleSceneEvent = (type: TetrisEventType) => {
     const listeners = eventListenersRef.current[type];
     if (listeners) {
       listeners.forEach(cb => cb());
     }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Scene, passing the event handler
    const sceneManager = new SceneManager(containerRef.current, config, handleSceneEvent);
    sceneManagerRef.current = sceneManager;
    
    // Start Render Loop
    sceneManager.render();

    return () => {
      sceneManager.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Sync config updates
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.updateConfig(config);
    }
  }, [config]);

  const handleConfigChange = (key: keyof GameConfig, value: number | boolean | string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    // We remove w-full h-full and use absolute inset-0 to fill the HOST container strictly
    <div className="absolute inset-0 overflow-hidden bg-black/90">
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-0"
      />
      
      {/* Vignette Overlay for extra cinematic feel */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

      {/* Only show Controls in Debug Mode */}
      {mode === 'debug' && (
        <Controls 
          config={config} 
          onChange={handleConfigChange} 
          onLoadConfig={setConfig}
        />
      )}

      {/* Title Overlay - Hidden in Live Mode for clean feed */}
      {mode === 'debug' && (
        <div className="absolute bottom-10 left-10 z-10 pointer-events-none select-none">
          <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]">
            TETRIS
          </h1>
          <h2 className="text-2xl font-bold text-white/80 tracking-[0.3em] ml-1 drop-shadow-md">
            FLOW
          </h2>
        </div>
      )}
    </div>
  );
};

export default App;
