
import { GameConfig } from '../types';

const STORAGE_PREFIX = 'tetris_flow_preset_';

export const PresetManager = {
  save: (name: string, config: GameConfig) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(config));
    } catch (e) {
      console.error("Failed to save preset", e);
    }
  },
  load: (name: string): GameConfig | null => {
    try {
      const data = localStorage.getItem(STORAGE_PREFIX + name);
      return data ? JSON.parse(data) : null;
    } catch (e) { 
      console.error("Failed to load preset", e);
      return null; 
    }
  },
  delete: (name: string) => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + name);
    } catch (e) {
      console.error("Failed to delete preset", e);
    }
  },
  list: (): string[] => {
    try {
      return Object.keys(localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .map(k => k.replace(STORAGE_PREFIX, ''));
    } catch (e) {
      return [];
    }
  }
};
