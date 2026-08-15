import React, { useState, useEffect } from 'react';
import { Volume2, Palette, Gamepad2, Monitor, Database, BarChart3, ArrowLeft } from 'lucide-react';
import { GameSettings, getGameSettings, saveGameSettings, resetGameSettings, updateSoundSettings } from '../utils/gameSettings';
import { soundManager } from '../utils/soundManager';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<GameSettings>(getGameSettings());

  // Load settings from localStorage on mount
  useEffect(() => {
    setSettings(getGameSettings());
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveGameSettings(settings);
  }, [settings]);

  const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const next: GameSettings = { ...settings, [key]: value };
    setSettings(next);

    // Update sound settings immediately
    if (key === 'soundEnabled' || key === 'soundVolume') {
      updateSoundSettings(next.soundEnabled, next.soundVolume);
    }
  };

  const resetToDefaults = () => {
    resetGameSettings();
    setSettings(getGameSettings());
  };

  const clearAllData = () => {
    if (window.confirm('This will clear all saved games and settings. This action cannot be undone. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Back button lives at the top: this page is long enough that a
            bottom-only exit meant scrolling the whole way down to leave. */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 text-gray-300 hover:text-white bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-lg transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Menu
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Settings</h1>
          <p className="text-lg text-gray-300">Customize your checker game experience</p>
        </div>

        {/* Settings Content */}
        <div className="bg-background-light/80 dark:bg-background-dark/90 backdrop-blur-sm rounded-2xl border border-primary/20 p-8 space-y-8">
          
          {/* Audio Settings */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Volume2 className="w-7 h-7 text-primary" aria-hidden="true" />
              Audio Settings
            </h2>
            <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Sound Effects</h3>
                    <p className="text-gray-300 text-sm">Enable sound effects for moves and captures</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.soundEnabled}
                      onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
                
                {settings.soundEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Volume: {Math.round(settings.soundVolume * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.soundVolume}
                      onChange={(e) => handleSettingChange('soundVolume', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
                
                {settings.soundEnabled && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        try {
                          soundManager.playMoveSound();
                        } catch (error) {
                          console.warn('Failed to play test sound:', error);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg transition-all duration-200 text-sm"
                    >
                      <Volume2 className="w-4 h-4" aria-hidden="true" />
                      Test Sound
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Visual Settings */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Palette className="w-7 h-7 text-primary" aria-hidden="true" />
              Visual Settings
            </h2>
            <div className="space-y-4">
              <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Animations</h3>
                    <p className="text-gray-300 text-sm">Enable piece animations and transitions</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.animationsEnabled}
                      onChange={(e) => handleSettingChange('animationsEnabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Board Theme</label>
                    <select
                      value={settings.boardTheme}
                      onChange={(e) => handleSettingChange('boardTheme', e.target.value as GameSettings['boardTheme'])}
                      className="w-full p-3 bg-background-light dark:bg-background-dark border border-primary/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="classic">Classic Wood</option>
                      <option value="modern">Modern Glass</option>
                      <option value="marble">Marble</option>
                      <option value="neon">Neon</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Piece Style</label>
                    <select
                      value={settings.pieceStyle}
                      onChange={(e) => handleSettingChange('pieceStyle', e.target.value as GameSettings['pieceStyle'])}
                      className="w-full p-3 bg-background-light dark:bg-background-dark border border-primary/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="standard">Standard</option>
                      <option value="minimal">Minimal</option>
                      <option value="detailed">Detailed</option>
                      <option value="retro">Retro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Gameplay Settings */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Gamepad2 className="w-7 h-7 text-primary" aria-hidden="true" />
              Gameplay Settings
            </h2>
            <div className="space-y-4">
              <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Auto-Save</h3>
                    <p className="text-gray-300 text-sm">Automatically save game progress</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Default AI Difficulty</label>
                    <select
                      value={settings.aiDifficulty}
                      onChange={(e) => handleSettingChange('aiDifficulty', e.target.value as GameSettings['aiDifficulty'])}
                      className="w-full p-3 bg-background-light dark:bg-background-dark border border-primary/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Game Speed</label>
                    <select
                      value={settings.gameSpeed}
                      onChange={(e) => handleSettingChange('gameSpeed', e.target.value as GameSettings['gameSpeed'])}
                      className="w-full p-3 bg-background-light dark:bg-background-dark border border-primary/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="slow">Slow</option>
                      <option value="normal">Normal</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* UI Settings */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Monitor className="w-7 h-7 text-primary" aria-hidden="true" />
              UI Settings
            </h2>
            <div className="space-y-4">
              <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Move Hints</h3>
                      <p className="text-gray-300 text-sm">Show visual hints for valid moves</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showMoveHints}
                        onChange={(e) => handleSettingChange('showMoveHints', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Capture Indicators</h3>
                      <p className="text-gray-300 text-sm">Highlight pieces with mandatory captures</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showCaptures}
                        onChange={(e) => handleSettingChange('showCaptures', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <Database className="w-7 h-7 text-primary" aria-hidden="true" />
              Data Management
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-yellow-500/10 rounded-lg p-6 border border-yellow-500/20">
                <h3 className="text-lg font-semibold text-yellow-300 mb-3">Reset Settings</h3>
                <p className="text-gray-300 text-sm mb-4">Restore all settings to their default values</p>
                <button
                  onClick={resetToDefaults}
                  className="w-full px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 rounded-lg transition-all duration-200"
                >
                  Reset to Defaults
                </button>
              </div>
              
              <div className="bg-red-500/10 rounded-lg p-6 border border-red-500/20">
                <h3 className="text-lg font-semibold text-red-300 mb-3">Clear All Data</h3>
                <p className="text-gray-300 text-sm mb-4">Delete all saved games and settings permanently</p>
                <button
                  onClick={clearAllData}
                  className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-200"
                >
                  Clear All Data
                </button>
              </div>
            </div>
          </section>

          {/* Game Statistics */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-primary" aria-hidden="true" />
              Game Statistics
            </h2>
            <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">0</div>
                  <div className="text-sm text-gray-300">Games Played</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">0</div>
                  <div className="text-sm text-gray-300">Games Won</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">0%</div>
                  <div className="text-sm text-gray-300">Win Rate</div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-400">Statistics tracking coming soon!</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default Settings;
