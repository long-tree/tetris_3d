
export type GridMatrix = (string | null)[][];

export type AppMode = 'debug' | 'live';

export interface GameConfig {
  // Gameplay
  bpm: number;
  enableLineClear: boolean; // If false, stacks until top then resets
  minLinesToClear: number; // For classic mode, how many lines to trigger clear
  gridRows: number;
  gridCols: number;
  
  // Camera
  cameraMode: 'orbit' | 'manual'; // 'front' is just a manual preset now
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  rotationSpeed: number;

  // Visuals
  temperature: number; // 0 to 1
  bloomStrength: number;
  opacity: number;
  gridVisible: boolean;
  fogDensity: number; // Controls atmosphere/brightness falloff
  
  // Flow / FX
  visualStyle: 'none' | 'wave' | 'plasma' | 'heart' | 'matrix' | 'fire' | 'scanline' | 'sparkle';
  flowSpeed: number;

  // Material & Atmosphere
  blockRoughness: number;
  blockMetalness: number;
  blockTransmission: number; // New: Glass effect
  blockThickness: number;    // New: Volume effect
  environmentDimming: number; // Legacy/Additional dimming
}

export interface Tetromino {
  shape: number[][];
  colorOffset: number; // Hue offset from base temperature
  pivot: { x: number; y: number };
}

export interface TetrisGlobalAPI {
  set: (key: keyof GameConfig, value: any) => void;
  setMode: (mode: AppMode) => void;
  loadPreset: (name: string) => void;
  getPresets: () => string[];
  bulkUpdate: (partialConfig: Partial<GameConfig>) => void;
  toggle: (key: keyof GameConfig) => void;
}

export interface TetrisSDK {
  /**
   * Initialize the 3D Background into a specific container
   * @param containerId The ID of the DOM element to mount the canvas into
   * @param options Optional initial configuration overrides
   */
  init: (containerId: string, options?: Partial<GameConfig>) => void;
  
  /**
   * Destroy the instance and cleanup resources
   */
  destroy: () => void;

  /**
   * Access the runtime control API (Available after init)
   */
  api: TetrisGlobalAPI | null;
}

declare global {
  interface Window {
    TetrisFlow: TetrisGlobalAPI; // The runtime controller
    TetrisSDK: TetrisSDK;        // The bootstrapper
  }
}

// Default constants for fallback
export const DEFAULT_COLS = 10;
export const DEFAULT_ROWS = 20;

export const SHAPES: Record<string, Tetromino> = {
  I: { 
    shape: [[1, 1, 1, 1]], 
    colorOffset: 0,
    pivot: { x: 1.5, y: 0.5 }
  },
  J: { 
    shape: [[1, 0, 0], [1, 1, 1]], 
    colorOffset: 0.1,
    pivot: { x: 1, y: 1 } 
  },
  L: { 
    shape: [[0, 0, 1], [1, 1, 1]], 
    colorOffset: 0.15,
    pivot: { x: 1, y: 1 } 
  },
  O: { 
    shape: [[1, 1], [1, 1]], 
    colorOffset: 0.2,
    pivot: { x: 0.5, y: 0.5 } 
  },
  S: { 
    shape: [[0, 1, 1], [1, 1, 0]], 
    colorOffset: 0.3,
    pivot: { x: 1, y: 1 } 
  },
  T: { 
    shape: [[0, 1, 0], [1, 1, 1]], 
    colorOffset: 0.5,
    pivot: { x: 1, y: 1 } 
  },
  Z: { 
    shape: [[1, 1, 0], [0, 1, 1]], 
    colorOffset: 0.8,
    pivot: { x: 1, y: 1 } 
  },
};
