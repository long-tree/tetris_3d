
import React, { useState, useEffect } from 'react';
import { GameConfig } from '../types';
import { Settings, Minimize2, Video, Grid, Palette, Zap, Save, Trash2, FolderOpen } from 'lucide-react';
import { PresetManager } from '../logic/PresetManager';

interface ControlsProps {
  config: GameConfig;
  onChange: (key: keyof GameConfig, value: number | boolean | string) => void;
  onLoadConfig: (newConfig: GameConfig) => void;
}

export const Controls: React.FC<ControlsProps> = ({ config, onChange, onLoadConfig }) => {
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'layout' | 'camera' | 'visuals' | 'presets'>('layout');
  
  // Preset State
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<string[]>([]);

  useEffect(() => {
    refreshPresets();
  }, []);

  const refreshPresets = () => {
    setSavedPresets(PresetManager.list());
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    PresetManager.save(presetName, config);
    setPresetName('');
    refreshPresets();
  };

  const handleLoadPreset = (name: string) => {
    const loaded = PresetManager.load(name);
    if (loaded) {
      onLoadConfig(loaded);
    }
  };

  const handleDeletePreset = (name: string) => {
    if (confirm(`Delete preset "${name}"?`)) {
      PresetManager.delete(name);
      refreshPresets();
    }
  };

  const setPreset = (preset: 'front' | 'iso' | 'top') => {
    onChange('cameraMode', 'manual');
    if (preset === 'front') {
      onChange('cameraX', 0);
      onChange('cameraY', 10); // Fixed center height
      onChange('cameraZ', Math.max(config.gridRows * 1.5, 30));
    } else if (preset === 'iso') {
      onChange('cameraX', 20);
      onChange('cameraY', 25);
      onChange('cameraZ', 30);
    } else if (preset === 'top') {
      onChange('cameraX', 0);
      onChange('cameraY', 45);
      onChange('cameraZ', 5);
    }
  };

  if (minimized) {
    return (
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={() => setMinimized(false)}
          className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-purple-500/50 text-purple-300 hover:bg-purple-900/40 transition-all"
        >
          <Settings size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl shadow-purple-900/20 z-50 text-gray-100 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
          SYSTEM CORE
        </h2>
        <button onClick={() => setMinimized(true)} className="text-gray-400 hover:text-white">
          <Minimize2 size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-5 bg-white/5 p-1 rounded-lg">
        <button 
          onClick={() => setActiveTab('layout')}
          className={`flex-1 flex items-center justify-center py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'layout' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Grid size={12} className="mr-1" /> Game
        </button>
        <button 
          onClick={() => setActiveTab('camera')}
          className={`flex-1 flex items-center justify-center py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'camera' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Video size={12} className="mr-1" /> View
        </button>
        <button 
          onClick={() => setActiveTab('visuals')}
          className={`flex-1 flex items-center justify-center py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'visuals' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Palette size={12} className="mr-1" /> Vibe
        </button>
         <button 
          onClick={() => setActiveTab('presets')}
          className={`flex-1 flex items-center justify-center py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors ${activeTab === 'presets' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <FolderOpen size={12} className="mr-1" /> Save
        </button>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        
        {/* GAMEPLAY TAB */}
        {activeTab === 'layout' && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs uppercase tracking-widest text-pink-300">
                <span>Speed (BPM)</span>
                <span>{config.bpm}</span>
              </div>
              <input
                type="range" min="60" max="600" step="10"
                value={config.bpm}
                onChange={(e) => onChange('bpm', Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>

            <div className="bg-white/5 p-3 rounded border border-white/5">
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={config.enableLineClear} 
                        onChange={(e) => onChange('enableLineClear', e.target.checked)}
                        className="form-checkbox h-4 w-4 text-purple-500 rounded focus:ring-purple-500 bg-gray-700 border-gray-600"
                    />
                    <div>
                        <span className="text-xs font-bold text-white uppercase block">Classic Line Clear</span>
                        <span className="text-[10px] text-gray-400 block">
                            {config.enableLineClear ? "Lines vanish when full (Infinite Play)" : "Blocks stack to top (Loop Animation)"}
                        </span>
                    </div>
                </label>
            </div>

            {config.enableLineClear && (
                 <div className="space-y-2 opacity-80 pl-2 border-l-2 border-purple-500/30">
                  <div className="flex justify-between text-xs uppercase text-green-300">
                    <span>Lines per Clear</span>
                    <span>{config.minLinesToClear}</span>
                  </div>
                  <input
                    type="range" min="1" max="4" step="1"
                    value={config.minLinesToClear}
                    onChange={(e) => onChange('minLinesToClear', Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <div className="flex justify-between text-xs uppercase text-gray-400">
                  <span>Height</span>
                  <span>{config.gridRows}</span>
                </div>
                <input
                  type="range" min="10" max="40" step="1"
                  value={config.gridRows}
                  onChange={(e) => onChange('gridRows', Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs uppercase text-gray-400">
                  <span>Width</span>
                  <span>{config.gridCols}</span>
                </div>
                <input
                  type="range" min="6" max="20" step="1"
                  value={config.gridCols}
                  onChange={(e) => onChange('gridCols', Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400"
                />
              </div>
            </div>
          </>
        )}

        {/* CAMERA TAB */}
        {activeTab === 'camera' && (
          <>
             <div className="flex space-x-2 mb-4">
               <button
                  onClick={() => onChange('cameraMode', 'orbit')}
                  className={`flex-1 py-1.5 text-xs uppercase border border-white/10 rounded font-bold ${config.cameraMode === 'orbit' ? 'bg-cyan-900/80 text-cyan-200 border-cyan-500' : 'text-gray-500 hover:bg-white/5'}`}
               >
                 Auto Orbit
               </button>
               <button
                  onClick={() => onChange('cameraMode', 'manual')}
                  className={`flex-1 py-1.5 text-xs uppercase border border-white/10 rounded font-bold ${config.cameraMode === 'manual' ? 'bg-cyan-900/80 text-cyan-200 border-cyan-500' : 'text-gray-500 hover:bg-white/5'}`}
               >
                 Manual
               </button>
             </div>

             {config.cameraMode === 'orbit' ? (
               <div className="space-y-2">
                 <div className="flex justify-between text-xs uppercase text-cyan-300">
                   <span>Orbit Speed</span>
                   <span>{config.rotationSpeed}</span>
                 </div>
                 <input
                   type="range" min="0" max="5" step="0.1"
                   value={config.rotationSpeed}
                   onChange={(e) => onChange('rotationSpeed', Number(e.target.value))}
                   className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                 />
               </div>
             ) : (
                <div className="space-y-4 animate-in fade-in">
                    {/* Presets */}
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setPreset('front')} className="p-1 text-[10px] bg-white/10 hover:bg-white/20 rounded text-center">FRONT</button>
                        <button onClick={() => setPreset('iso')} className="p-1 text-[10px] bg-white/10 hover:bg-white/20 rounded text-center">ISO</button>
                        <button onClick={() => setPreset('top')} className="p-1 text-[10px] bg-white/10 hover:bg-white/20 rounded text-center">TOP</button>
                    </div>

                    <div className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase text-gray-400">
                            <span>Pos X</span>
                            <span>{config.cameraX}</span>
                        </div>
                        <input
                            type="range" min="-50" max="50" step="1"
                            value={config.cameraX}
                            onChange={(e) => onChange('cameraX', Number(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-500"
                        />
                        </div>
                        <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase text-gray-400">
                            <span>Pos Y</span>
                            <span>{config.cameraY}</span>
                        </div>
                        <input
                            type="range" min="-10" max="60" step="1"
                            value={config.cameraY}
                            onChange={(e) => onChange('cameraY', Number(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-500"
                        />
                        </div>
                        <div className="space-y-1">
                        <div className="flex justify-between text-[10px] uppercase text-gray-400">
                            <span>Pos Z</span>
                            <span>{config.cameraZ}</span>
                        </div>
                        <input
                            type="range" min="0" max="100" step="1"
                            value={config.cameraZ}
                            onChange={(e) => onChange('cameraZ', Number(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-500"
                        />
                        </div>
                    </div>
                </div>
             )}
          </>
        )}

        {/* VISUALS TAB */}
        {activeTab === 'visuals' && (
          <>
            <div className="mb-4 space-y-3 p-3 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-white/10">
               <div className="flex items-center space-x-2 text-yellow-300 mb-2">
                 <Zap size={14} />
                 <span className="text-xs font-bold uppercase">Light Flow FX</span>
               </div>
               
               <div className="grid grid-cols-4 gap-2">
                 {['none', 'wave', 'plasma', 'heart', 'matrix', 'fire', 'scanline', 'sparkle'].map((style) => (
                   <button
                     key={style}
                     onClick={() => onChange('visualStyle', style)}
                     className={`text-[9px] uppercase py-2 rounded border transition-all truncate ${config.visualStyle === style ? 'bg-yellow-500/20 border-yellow-500 text-yellow-200' : 'bg-black/20 border-white/10 text-gray-400 hover:border-white/30'}`}
                   >
                     {style}
                   </button>
                 ))}
               </div>

               {config.visualStyle !== 'none' && (
                 <div className="space-y-1 mt-2">
                   <div className="flex justify-between text-[10px] uppercase text-gray-400">
                     <span>Flow Speed</span>
                     <span>{config.flowSpeed}</span>
                   </div>
                   <input
                    type="range" min="0.1" max="5.0" step="0.1"
                    value={config.flowSpeed}
                    onChange={(e) => onChange('flowSpeed', Number(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-yellow-500"
                   />
                 </div>
               )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs uppercase tracking-widest text-blue-300">
                <span>Palette Shift</span>
              </div>
              <div className="relative w-full h-3 rounded-lg overflow-hidden bg-gray-700 ring-1 ring-white/20">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-500 to-red-500"></div>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={config.temperature}
                  onChange={(e) => onChange('temperature', Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs uppercase text-purple-300">
                <span>Bloom Intensity</span>
                <span>{config.bloomStrength.toFixed(1)}</span>
              </div>
              <input
                type="range" min="0" max="3" step="0.1"
                value={config.bloomStrength}
                onChange={(e) => onChange('bloomStrength', Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
            
             <div className="space-y-2">
              <div className="flex justify-between text-xs uppercase text-gray-300">
                <span>Fog Density</span>
                <span>{(config.fogDensity * 1000).toFixed(1)}</span>
              </div>
              <input
                type="range" min="0" max="0.15" step="0.005"
                value={config.fogDensity}
                onChange={(e) => onChange('fogDensity', Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-500"
              />
            </div>

             <div className="space-y-2">
              <div className="flex justify-between text-xs uppercase text-gray-300">
                <span>Block Opacity</span>
                <span>{(config.opacity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={config.opacity}
                onChange={(e) => onChange('opacity', Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400"
              />
            </div>

            <div className="border-t border-white/10 pt-4 mt-4">
               <h3 className="text-xs font-bold text-gray-400 mb-2">MATERIAL PROPERTIES</h3>
               
               <div className="grid grid-cols-2 gap-3 mb-2">
                 <div className="space-y-1">
                   <label className="text-[10px] text-gray-500 uppercase">Roughness</label>
                   <input
                    type="range" min="0" max="1" step="0.1"
                    value={config.blockRoughness}
                    onChange={(e) => onChange('blockRoughness', Number(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded cursor-pointer accent-white"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] text-gray-500 uppercase">Metalness</label>
                   <input
                    type="range" min="0" max="1" step="0.1"
                    value={config.blockMetalness}
                    onChange={(e) => onChange('blockMetalness', Number(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded cursor-pointer accent-white"
                   />
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                   <label className="text-[10px] text-gray-500 uppercase">Glass (Transmission)</label>
                   <input
                    type="range" min="0" max="1" step="0.1"
                    value={config.blockTransmission}
                    onChange={(e) => onChange('blockTransmission', Number(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded cursor-pointer accent-cyan-400"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] text-gray-500 uppercase">Thickness</label>
                   <input
                    type="range" min="0" max="2" step="0.1"
                    value={config.blockThickness}
                    onChange={(e) => onChange('blockThickness', Number(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded cursor-pointer accent-cyan-400"
                   />
                 </div>
               </div>

            </div>
          </>
        )}

        {/* PRESETS TAB */}
        {activeTab === 'presets' && (
           <div className="space-y-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <label className="text-xs uppercase text-gray-400 block mb-2">Save Current Preset</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset Name..."
                    className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                  <button 
                    onClick={handleSavePreset}
                    disabled={!presetName}
                    className="p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-white transition-colors"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                 <div className="text-xs uppercase text-gray-400 mb-1">Load Presets</div>
                 {savedPresets.length === 0 ? (
                   <div className="text-center py-4 text-gray-600 text-xs italic">No saved presets</div>
                 ) : (
                   <div className="grid grid-cols-1 gap-2">
                     {savedPresets.map(name => (
                       <div key={name} className="flex items-center justify-between bg-white/5 p-2 rounded hover:bg-white/10 group transition-colors">
                          <button 
                            onClick={() => handleLoadPreset(name)}
                            className="text-sm text-gray-200 text-left flex-1"
                          >
                            {name}
                          </button>
                          <button 
                            onClick={() => handleDeletePreset(name)}
                            className="text-gray-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
           </div>
        )}

      </div>
    </div>
  );
};
