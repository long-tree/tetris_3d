
import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from './logic/SceneManager';
import { GameConfig, DEFAULT_ROWS, DEFAULT_COLS } from './types';
import { Controls } from './components/Controls';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  const [config, setConfig] = useState<GameConfig>({
    bpm: 300,
    temperature: 0.5,
    bloomStrength: 1.5,
    opacity: 0.9,
    gridVisible: true,
    fogDensity: 0.035, // Default fog
    
    // New Settings defaults
    gridRows: DEFAULT_ROWS,
    gridCols: DEFAULT_COLS,
    minLinesToClear: 1,
    enableLineClear: true, // Default to classic tetris logic
    
    cameraMode: 'orbit',
    rotationSpeed: 0.5,
    cameraX: 0,
    cameraY: 10,
    cameraZ: 30,
    
    // Flow
    visualStyle: 'matrix', // Default to new matrix effect
    flowSpeed: 2.0,
    
    // Material Defaults (Glassy/Cyberpunk)
    blockRoughness: 0.1, // Shiny
    blockMetalness: 0.5, // Slightly metallic
    blockTransmission: 0.2, // Slight glassiness by default
    blockThickness: 1.0,
    environmentDimming: 0
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Scene
    const sceneManager = new SceneManager(containerRef.current, config);
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
    <div className="relative w-full h-full bg-black">
      <div 
        ref={containerRef} 
        className="absolute inset-0 z-0"
      />
      
      {/* Vignette Overlay for extra cinematic feel */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

      <Controls config={config} onChange={handleConfigChange} />

      {/* Title Overlay */}
      <div className="absolute bottom-10 left-10 z-10 pointer-events-none select-none">
        <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]">
          TETRIS
        </h1>
        <h2 className="text-2xl font-bold text-white/80 tracking-[0.3em] ml-1 drop-shadow-md">
          FLOW
        </h2>
      </div>
    </div>
  );
};

export default App;
