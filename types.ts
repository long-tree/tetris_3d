
export type GridMatrix = (string | null)[][];

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