import React, { useState, useEffect } from 'react';
import {
  SaveData,
  ScreenState,
  LevelCompletionSummary,
} from './types/game';
import { WORLDS_DATA } from './data/worlds';
import { LEVELS_DATA, getLevelById, getLevelsByWorld } from './data/levels';
import {
  loadSaveData,
  saveProgressData,
  resetAllProgress,
  getLevelProgress,
  getWorldStats,
  getGlobalStats,
} from './systems/storage';
import { AudioSystem } from './systems/audio';
import { CharacterIllustration } from './components/CharacterIllustration';
import { PWAInstallButton } from './components/PWAInstallButton';
import { GameCanvas } from './engine/GameCanvas';
import {
  Play,
  Map as MapIcon,
  Settings,
  Volume2,
  VolumeX,
  Music,
  Trash2,
  Lock,
  CheckCircle2,
  ArrowRight,
  Home,
  X,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<ScreenState>('HOME');
  const [currentLevelId, setCurrentLevelId] = useState<number>(1);
  const [lastSummary, setLastSummary] = useState<LevelCompletionSummary | null>(null);
  const [expandedWorldId, setExpandedWorldId] = useState<number>(1);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  // Sincronizar preferencias de audio y guardar en localStorage
  useEffect(() => {
    AudioSystem.soundEnabled = saveData.soundEnabled;
    AudioSystem.musicEnabled = saveData.musicEnabled;
    saveProgressData(saveData);
  }, [saveData]);

  const startLevel = (levelId: number) => {
    AudioSystem.startMusic();
    setCurrentLevelId(levelId);
    setScreen('GAME');
  };

  // Botón PLAY principal: lleva al siguiente nivel pendiente (o al Nivel 1 al empezar)
  const handlePlayFromHome = () => {
    AudioSystem.unlock();
    AudioSystem.startMusic();
    const targetLevel = Math.min(35, Math.max(1, saveData.unlockedLevel));
    setCurrentLevelId(targetLevel);
    setScreen('GAME');
  };

  // Al completar un nivel
  const handleLevelComplete = (summary: LevelCompletionSummary) => {
    setLastSummary(summary);

    setSaveData((prev) => {
      const existing = getLevelProgress(prev, summary.levelId);
      const mergedCores: [boolean, boolean, boolean] = [
        existing.dataCoresCollected[0] || summary.dataCoresMask[0],
        existing.dataCoresCollected[1] || summary.dataCoresMask[1],
        existing.dataCoresCollected[2] || summary.dataCoresMask[2],
      ];

      // Las Bytecoins NUNCA se gastan: se acumulan permanentemente
      const updatedTotalBytecoins = prev.totalBytecoins + summary.bytecoinsEarned;
      const nextLevelId = Math.min(35, summary.levelId + 1);
      const nextLevelConfig = getLevelById(nextLevelId);

      const newUnlockedLevel = Math.max(prev.unlockedLevel, nextLevelId);
      const newUnlockedWorld = Math.max(
        prev.unlockedWorld,
        summary.isWorldEnd ? Math.min(7, nextLevelConfig.worldId) : prev.unlockedWorld
      );

      return {
        ...prev,
        totalBytecoins: updatedTotalBytecoins,
        unlockedLevel: newUnlockedLevel,
        unlockedWorld: newUnlockedWorld,
        levels: {
          ...prev.levels,
          [summary.levelId]: {
            completed: true,
            stars: Math.max(existing.stars, summary.stars) as 0 | 1 | 2 | 3,
            bestScore: Math.max(existing.bestScore, summary.totalScore),
            dataCoresCollected: mergedCores,
            bytecoinsEarned: Math.max(existing.bytecoinsEarned, summary.bytecoinsEarned),
          },
        },
      };
    });

    setScreen('LEVEL_COMPLETE');
  };

  // Navegación continua entre niveles sin obligar a volver al mapa
  const handleContinueAfterLevel = () => {
    if (!lastSummary) return;

    // Si acaba de terminar el Nivel 35 -> FINAL DEL JUEGO
    if (lastSummary.isGameEnd || lastSummary.levelId === 35) {
      AudioSystem.systemRestored();
      setScreen('GAME_ENDING');
      return;
    }

    // Si acaba de terminar el Nivel 5 de un mundo -> Pantalla de transición "[WORLD] UNLOCKED!"
    if (lastSummary.isWorldEnd) {
      AudioSystem.worldTransition();
      setScreen('WORLD_TRANSITION');
      return;
    }

    // Flujo normal: siguiente nivel directamente
    const nextId = Math.min(35, lastSummary.levelId + 1);
    startLevel(nextId);
  };

  // Continuar desde la pantalla de transición de mundo al Nivel 1 del siguiente mundo
  const handleContinueFromWorldTransition = () => {
    if (!lastSummary) return;
    const nextId = Math.min(35, lastSummary.levelId + 1);
    AudioSystem.unlock();
    startLevel(nextId);
  };

  const toggleSound = () => {
    setSaveData((prev) => {
      const next = !prev.soundEnabled;
      AudioSystem.soundEnabled = next;
      return { ...prev, soundEnabled: next };
    });
  };

  const toggleMusic = () => {
    setSaveData((prev) => {
      const next = !prev.musicEnabled;
      AudioSystem.musicEnabled = next;
      if (next) AudioSystem.startMusic();
      else AudioSystem.stopMusic();
      return { ...prev, musicEnabled: next };
    });
  };

  const handleConfirmReset = () => {
    const fresh = resetAllProgress();
    setSaveData(fresh);
    setConfirmReset(false);
    setShowSettingsModal(false);
    setExpandedWorldId(1);
    setScreen('HOME');
  };

  const currentLevelConfig = getLevelById(currentLevelId);
  const globalStats = getGlobalStats(saveData);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#03060C] overflow-hidden select-none">
      {/* Contenedor Mobile-First Vertical (Pantalla completa en smartphone, marco vertical limpio en escritorio) */}
      <div className="relative w-full h-full max-w-[480px] mx-auto flex flex-col justify-between bg-[#050811] border-x border-[#00E5FF]/20 shadow-[0_0_50px_rgba(0,229,255,0.12)] overflow-hidden">
        {/* =====================================================================
            1. PANTALLA PRINCIPAL (HOME)
           ===================================================================== */}
        {screen === 'HOME' && (
          <div className="relative w-full h-full flex flex-col items-center justify-between p-6 z-10 overflow-y-auto">
            {/* Decoración tecnológica de fondo */}
            <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(circle_at_50%_25%,#00E5FF_0%,transparent_60%)]" />

            {/* Barra superior de estado */}
            <div className="w-full flex items-center justify-between z-10">
              <div className="flex items-center gap-2 bg-[#0A1428] border border-[#00E5FF]/40 px-3 py-1.5 rounded-full text-xs font-mono-tech text-[#00E5FF]">
                <span>🪙 {saveData.totalBytecoins}</span>
                <span className="text-slate-600">|</span>
                <span className="text-[#00FF66]">⭐ {globalStats.totalStars}/105</span>
              </div>

              <button
                onClick={() => {
                  setConfirmReset(false);
                  setShowSettingsModal(true);
                }}
                aria-label="Settings"
                className="p-2.5 rounded-2xl bg-[#0A1428] border border-[#00E5FF]/40 text-[#00E5FF] hover:bg-[#00E5FF]/15 active:scale-95 transition cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Bloque Central: Título + Personaje The Hacker */}
            <div className="flex flex-col items-center text-center my-auto py-2 z-10">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/50 text-[#00FF66] font-mono-tech text-[11px] font-bold tracking-widest mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>2D ARCADE PLATFORMER</span>
              </div>

              <h1 className="font-arcade text-4xl sm:text-5xl font-black tracking-tight text-white text-electric-glow leading-none">
                THE HACKER
              </h1>
              <h2 className="font-mono-tech text-lg sm:text-xl font-extrabold tracking-[0.28em] text-[#00FF66] text-matrix-glow mt-1 mb-3">
                DIGITAL WORLD
              </h2>

              {/* Asset Principal de The Hacker */}
              <div className="relative my-1">
                <CharacterIllustration size={185} />
              </div>

              <p className="text-xs text-slate-300 max-w-xs leading-relaxed mt-1">
                Recorre los <span className="text-[#00E5FF] font-bold">7 mundos digitales</span>, supera los{' '}
                <span className="text-[#00FF66] font-bold">35 niveles</span> y detén la corrupción en el Digital Core.
              </p>
            </div>

            {/* Botones Principales: PLAY, MAP, SETTINGS + Instalación PWA */}
            <div className="w-full flex flex-col gap-3 z-10">
              <button
                onClick={handlePlayFromHome}
                className="w-full py-4 rounded-2xl bg-[#00FF66] hover:bg-[#1aff75] text-[#050811] font-arcade text-xl font-black tracking-wider shadow-[0_0_25px_rgba(0,255,102,0.45)] flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>PLAY</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setExpandedWorldId(saveData.unlockedWorld);
                    setScreen('MAP');
                  }}
                  className="py-3.5 rounded-2xl bg-[#0A152C] border-2 border-[#00E5FF] text-[#00E5FF] font-arcade text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>MAP</span>
                </button>

                <button
                  onClick={() => {
                    setConfirmReset(false);
                    setShowSettingsModal(true);
                  }}
                  className="py-3.5 rounded-2xl bg-[#0A152C] border-2 border-[#00E5FF]/50 text-slate-200 font-arcade text-sm font-extrabold tracking-wide flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-[#00E5FF]" />
                  <span>SETTINGS</span>
                </button>
              </div>

              <PWAInstallButton />
            </div>
          </div>
        )}

        {/* =====================================================================
            2. MAPA GENERAL ÚNICO (WORLD 1 -> WORLD 7 LINEAL)
           ===================================================================== */}
        {screen === 'MAP' && (
          <div className="w-full h-full flex flex-col justify-between bg-[#050811] overflow-hidden">
            {/* Cabecera del Mapa General */}
            <header className="px-4 py-3 bg-[#081124] border-b border-[#00E5FF]/30 flex items-center justify-between shrink-0">
              <button
                onClick={() => setScreen('HOME')}
                className="p-2 rounded-xl bg-[#0C1A36] border border-[#00E5FF]/50 text-[#00E5FF] flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>INICIO</span>
              </button>

              <div className="text-center">
                <h2 className="font-arcade text-base font-black text-[#00E5FF] tracking-wide">
                  WORLD MAP
                </h2>
                <p className="text-[10px] font-mono-tech text-[#00FF66]">
                  7 MUNDOS · 35 NIVELES LINEALES
                </p>
              </div>

              <div className="bg-[#050811] border border-[#00E5FF]/40 px-2.5 py-1 rounded-xl font-mono-tech text-xs font-bold text-[#00E5FF]">
                🪙 {saveData.totalBytecoins}
              </div>
            </header>

            {/* Camino Lineal Único: WORLD 1 -> WORLD 2 -> ... -> WORLD 7 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {WORLDS_DATA.map((world, idx) => {
                const isUnlocked = world.id <= saveData.unlockedWorld;
                const stats = getWorldStats(saveData, world.id);
                const isExpanded = expandedWorldId === world.id;
                const worldLevels = getLevelsByWorld(world.id);

                return (
                  <div key={world.id} className="relative">
                    {/* Conector lineal vertical entre mundos */}
                    {idx > 0 && (
                      <div className="flex justify-center -mt-3 mb-1">
                        <div
                          className={`w-1 h-5 rounded-full ${
                            isUnlocked ? 'bg-[#00FF66] shadow-[0_0_10px_#00FF66]' : 'bg-slate-800'
                          }`}
                        />
                      </div>
                    )}

                    <div
                      className={`rounded-3xl border-2 transition-all overflow-hidden ${
                        isUnlocked
                          ? 'bg-[#09142A] border-[#00E5FF] electric-glow'
                          : 'bg-[#070C18] border-slate-800 opacity-65'
                      }`}
                    >
                      {/* Cabecera del Nodo del Mundo */}
                      <div
                        onClick={() => {
                          if (isUnlocked) {
                            setExpandedWorldId(isExpanded ? 0 : world.id);
                          }
                        }}
                        className={`p-4 flex items-center justify-between gap-3 ${
                          isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl font-arcade text-lg font-black flex items-center justify-center shrink-0 ${
                              stats.completedCount === 5
                                ? 'bg-[#00FF66] text-[#050811]'
                                : isUnlocked
                                ? 'bg-[#00E5FF] text-[#050811]'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isUnlocked ? world.id : <Lock className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tech text-[10px] font-bold text-[#00FF66]">
                                WORLD {world.id}
                              </span>
                              <span
                                className={`text-[10px] font-mono-tech px-2 py-0.5 rounded-full font-bold ${
                                  isUnlocked
                                    ? 'bg-[#00FF66]/15 text-[#00FF66]'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                              </span>
                            </div>
                            <h3 className="font-arcade text-base font-extrabold text-white truncate">
                              {world.name}
                            </h3>
                            <p className="text-[11px] text-slate-300 truncate">{world.subtitle}</p>
                          </div>
                        </div>

                        {/* Resumen de progreso de sus 5 niveles y estrellas */}
                        <div className="text-right font-mono-tech shrink-0">
                          <div className="text-xs font-extrabold text-[#00E5FF]">
                            {stats.completedCount}/5 LVL
                          </div>
                          <div className="text-[11px] text-[#00FF66]">
                            ⭐ {stats.starsEarned}/15
                          </div>
                          <div className="text-[10px] text-slate-400">
                            💾 {stats.dataCoresEarned}/15
                          </div>
                        </div>
                      </div>

                      {/* Lista lineal de los 5 niveles del mundo cuando está desbloqueado y desplegado */}
                      {isUnlocked && isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-[#00E5FF]/20 bg-[#050A16] space-y-2">
                          <p className="text-[11px] text-slate-300 italic mb-2">{world.storyHint}</p>

                          {worldLevels.map((lvl) => {
                            const lvlProg = getLevelProgress(saveData, lvl.id);
                            const lvlUnlocked = lvl.id <= saveData.unlockedLevel;
                            const coresCount = lvlProg.dataCoresCollected.filter(Boolean).length;

                            return (
                              <div
                                key={lvl.id}
                                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                                  lvlUnlocked
                                    ? 'bg-[#0A152C] border-[#00E5FF]/50'
                                    : 'bg-[#070B14] border-slate-800 opacity-60'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-[10px] font-mono-tech">
                                    <span className="text-[#00E5FF] font-bold">
                                      LVL {lvl.id} ({lvl.levelInWorld}/5)
                                    </span>
                                    <span className="text-[#00FF66]">{lvl.progressionRole}</span>
                                  </div>
                                  <div className="font-arcade text-sm font-bold text-white truncate">
                                    {lvl.name}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] font-mono-tech text-slate-300 mt-0.5">
                                    <span>
                                      {lvlProg.stars > 0
                                        ? '⭐'.repeat(lvlProg.stars)
                                        : '☆☆☆'}
                                    </span>
                                    <span>💾 {coresCount}/3</span>
                                    <span>🪙 +{lvl.bytecoins}</span>
                                  </div>
                                </div>

                                {lvlUnlocked ? (
                                  <button
                                    onClick={() => startLevel(lvl.id)}
                                    className="px-4 py-2 rounded-xl bg-[#00FF66] text-[#050811] font-arcade text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer"
                                  >
                                    <span>PLAY</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-slate-500 font-mono-tech text-[10px] font-bold shrink-0">
                                    🔒 LOCKED
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================================================================
            3. PANTALLA DE JUEGO (GAME)
           ===================================================================== */}
        {screen === 'GAME' && (
          <GameCanvas
            level={currentLevelConfig}
            initialTotalBytecoins={saveData.totalBytecoins}
            initialBestDataCores={getLevelProgress(saveData, currentLevelConfig.id).dataCoresCollected}
            onLevelComplete={handleLevelComplete}
            onExitToMap={() => {
              setExpandedWorldId(currentLevelConfig.worldId);
              setScreen('MAP');
            }}
          />
        )}

        {/* =====================================================================
            4. PANTALLA DE NIVEL COMPLETADO (LEVEL COMPLETE)
           ===================================================================== */}
        {screen === 'LEVEL_COMPLETE' && lastSummary && (
          <div className="w-full h-full flex flex-col items-center justify-between p-6 bg-[#050811] text-center overflow-y-auto">
            <div className="w-full flex items-center justify-between text-xs font-mono-tech text-slate-400">
              <span>WORLD {getLevelById(lastSummary.levelId).worldId}</span>
              <span>LEVEL {lastSummary.levelId}/35</span>
            </div>

            <div className="w-full max-w-sm rounded-3xl bg-[#09142A] border-2 border-[#00E5FF] p-6 space-y-4 electric-glow my-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00FF66]/15 text-[#00FF66] font-mono-tech text-xs font-extrabold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{getLevelById(lastSummary.levelId).name}</span>
              </div>

              <h2 className="font-arcade text-3xl font-black text-white text-electric-glow">
                LEVEL COMPLETE
              </h2>

              {/* Estrellas obtenidas (⭐ a ⭐⭐⭐) */}
              <div className="text-4xl tracking-widest py-1">
                {'⭐'.repeat(lastSummary.stars)}
              </div>

              {/* Desglose exacto de la especificación (Sección 19) */}
              <div className="bg-[#050811] rounded-2xl border border-[#00E5FF]/30 p-4 space-y-2.5 font-mono-tech text-sm">
                <div className="flex items-center justify-between text-[#00E5FF] font-bold">
                  <span>🪙 + BYTECOINS</span>
                  <span>+{lastSummary.bytecoinsEarned} (TOTAL: {saveData.totalBytecoins})</span>
                </div>

                <div className="flex items-center justify-between text-[#00FF66] font-bold">
                  <span>💾 DATA CORES</span>
                  <span>{lastSummary.dataCoresCount}/3</span>
                </div>

                <div className="flex items-center justify-between text-slate-200 font-bold">
                  <span>⚡ TIME BONUS</span>
                  <span>+{lastSummary.timeBonus}</span>
                </div>

                <div className="border-t border-[#00E5FF]/30 pt-2.5 flex items-center justify-between text-lg font-black text-white">
                  <span>SCORE:</span>
                  <span className="text-[#00FF66]">{lastSummary.totalScore}</span>
                </div>
              </div>

              {/* Botones: CONTINUE (directo al siguiente nivel) y MAP/HOME */}
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={handleContinueAfterLevel}
                  className="w-full py-4 rounded-2xl bg-[#00FF66] hover:bg-[#1aff75] text-[#050811] font-arcade text-lg font-black tracking-wider shadow-[0_0_20px_rgba(0,255,102,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>CONTINUE</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => {
                    setExpandedWorldId(getLevelById(lastSummary.levelId).worldId);
                    setScreen('MAP');
                  }}
                  className="w-full py-3 rounded-2xl bg-[#0C1A36] border border-[#00E5FF] text-[#00E5FF] font-arcade text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>MAP / HOME</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono-tech text-slate-400">
              LAS BYTECOINS SE ACUMULAN Y NUNCA SE GASTAN
            </div>
          </div>
        )}

        {/* =====================================================================
            5. PANTALLA DE TRANSICIÓN ENTRE MUNDOS (WORLD UNLOCKED!)
           ===================================================================== */}
        {screen === 'WORLD_TRANSITION' && lastSummary && (
          <div className="w-full h-full flex flex-col items-center justify-between p-6 bg-[#050811] text-center overflow-y-auto">
            <div />
            <div className="w-full max-w-sm rounded-3xl bg-[#09142A] border-2 border-[#00FF66] p-6 space-y-4 matrix-glow my-auto">
              <CharacterIllustration size={135} className="mx-auto" />

              <div className="font-mono-tech text-xs font-extrabold text-[#00FF66] tracking-widest">
                {getLevelById(lastSummary.levelId).worldCompleteBanner?.restoredText ||
                  'SYSTEM RESTORED!'}
              </div>

              <h2 className="font-arcade text-3xl font-black text-[#00E5FF] text-electric-glow">
                {getLevelById(lastSummary.levelId).worldCompleteBanner?.unlockedText ||
                  'NEXT WORLD UNLOCKED!'}
              </h2>

              <p className="text-xs text-slate-200 leading-relaxed bg-[#050811] p-3.5 rounded-2xl border border-[#00E5FF]/30">
                {
                  WORLDS_DATA.find(
                    (w) => w.id === Math.min(7, getLevelById(lastSummary.levelId).worldId + 1)
                  )?.storyHint
                }
              </p>

              <button
                onClick={handleContinueFromWorldTransition}
                className="w-full py-4 rounded-2xl bg-[#00FF66] text-[#050811] font-arcade text-base font-black tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>CONTINUE TO LEVEL 1</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setExpandedWorldId(Math.min(7, getLevelById(lastSummary.levelId).worldId + 1));
                  setScreen('MAP');
                }}
                className="w-full py-2.5 rounded-2xl bg-[#0C1A36] text-[#00E5FF] font-arcade text-xs font-bold cursor-pointer"
              >
                MAP / HOME
              </button>
            </div>
            <div />
          </div>
        )}

        {/* =====================================================================
            6. FINAL DEL JUEGO (NIVEL 35 COMPLETADO - SECCIÓN 58)
           ===================================================================== */}
        {screen === 'GAME_ENDING' && (
          <div className="w-full h-full flex flex-col items-center justify-between p-5 bg-[#050811] text-center overflow-y-auto space-y-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#09142A] border-2 border-[#00FF66] p-5 space-y-3.5 matrix-glow my-auto">
              <div className="space-y-1">
                <div className="font-mono-tech text-xs font-extrabold text-[#00FF66] tracking-widest">
                  SYSTEM RESTORED · DIGITAL WORLD SECURED
                </div>
                <h2 className="font-arcade text-2xl font-black text-[#00E5FF] text-electric-glow">
                  CONGRATULATIONS, HACKER!
                </h2>
              </div>

              {/* Intercambio humorístico exacto entre AI y THE HACKER */}
              <div className="bg-[#050811] rounded-2xl border border-[#00E5FF]/40 p-3.5 text-left space-y-2 text-xs">
                <div className="bg-[#0A1931] p-2.5 rounded-xl border-l-4 border-[#00E5FF]">
                  <span className="font-mono-tech font-extrabold text-[#00E5FF] block">AI:</span>
                  <span className="text-white font-semibold">"OPTIMIZATION COMPLETE."</span>
                </div>

                <div className="bg-[#081C18] p-2.5 rounded-xl border-l-4 border-[#00FF66]">
                  <span className="font-mono-tech font-extrabold text-[#00FF66] block">
                    THE HACKER:
                  </span>
                  <span className="text-white font-semibold">"¿Seguro?"</span>
                </div>

                <div className="bg-[#0A1931] p-2 rounded-xl border-l-4 border-[#00E5FF]">
                  <span className="font-mono-tech font-extrabold text-[#00E5FF] block">AI:</span>
                  <span className="text-white font-semibold">"..."</span>
                </div>

                <div className="bg-[#081C18] p-2.5 rounded-xl border-l-4 border-[#00FF66]">
                  <span className="font-mono-tech font-extrabold text-[#00FF66] block">
                    THE HACKER:
                  </span>
                  <span className="text-white font-semibold">
                    "Primero voy a hacer una copia de seguridad."
                  </span>
                </div>
              </div>

              <h3 className="font-arcade text-xl font-black text-[#00FF66] text-matrix-glow pt-1">
                YOU SAVED THE DIGITAL WORLD!
              </h3>

              {/* Estadísticas globales finales */}
              <div className="grid grid-cols-2 gap-2 font-mono-tech text-xs bg-[#050811] p-3 rounded-2xl border border-[#00FF66]/30">
                <div className="p-2 rounded-xl bg-[#09142A]">
                  <div className="text-slate-400 text-[10px]">BYTECOINS TOTALES</div>
                  <div className="text-sm font-black text-[#00E5FF]">
                    🪙 {saveData.totalBytecoins}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#09142A]">
                  <div className="text-slate-400 text-[10px]">DATA CORES</div>
                  <div className="text-sm font-black text-[#00FF66]">
                    💾 {globalStats.totalDataCores}/105
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#09142A]">
                  <div className="text-slate-400 text-[10px]">ESTRELLAS TOTALES</div>
                  <div className="text-sm font-black text-[#00E5FF]">
                    ⭐ {globalStats.totalStars}/105
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#09142A]">
                  <div className="text-slate-400 text-[10px]">PUNTUACIÓN FINAL</div>
                  <div className="text-sm font-black text-[#00FF66]">
                    🏆 {globalStats.totalScore}
                  </div>
                </div>
              </div>

              {/* Botones PLAY AGAIN y MAIN MAP */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => startLevel(1)}
                  className="py-3.5 rounded-2xl bg-[#00FF66] text-[#050811] font-arcade text-sm font-black cursor-pointer"
                >
                  PLAY AGAIN
                </button>
                <button
                  onClick={() => {
                    setExpandedWorldId(7);
                    setScreen('MAP');
                  }}
                  className="py-3.5 rounded-2xl bg-[#0C1A36] border border-[#00E5FF] text-[#00E5FF] font-arcade text-sm font-black cursor-pointer"
                >
                  MAIN MAP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            7. MODAL DE CONFIGURACIÓN (SETTINGS - SECCIÓN 65)
           ===================================================================== */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#09142A] border-2 border-[#00E5FF] p-6 space-y-4 electric-glow">
              <div className="flex items-center justify-between border-b border-[#00E5FF]/25 pb-3">
                <h3 className="font-arcade text-xl font-black text-[#00E5FF]">SETTINGS</h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sound ON/OFF */}
              <div className="flex items-center justify-between bg-[#050811] p-3.5 rounded-2xl border border-[#00E5FF]/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                  {saveData.soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-[#00FF66]" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-slate-500" />
                  )}
                  <span>Sound Effects</span>
                </div>
                <button
                  onClick={toggleSound}
                  className={`px-4 py-1.5 rounded-xl font-mono-tech text-xs font-extrabold cursor-pointer ${
                    saveData.soundEnabled
                      ? 'bg-[#00FF66] text-[#050811]'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {saveData.soundEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Music ON/OFF */}
              <div className="flex items-center justify-between bg-[#050811] p-3.5 rounded-2xl border border-[#00E5FF]/30">
                <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                  <Music
                    className={`w-5 h-5 ${
                      saveData.musicEnabled ? 'text-[#00E5FF]' : 'text-slate-500'
                    }`}
                  />
                  <span>Music</span>
                </div>
                <button
                  onClick={toggleMusic}
                  className={`px-4 py-1.5 rounded-xl font-mono-tech text-xs font-extrabold cursor-pointer ${
                    saveData.musicEnabled
                      ? 'bg-[#00E5FF] text-[#050811]'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {saveData.musicEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Reset Progress con confirmación */}
              <div className="bg-[#050811] p-3.5 rounded-2xl border border-[#00E5FF]/30 space-y-2.5">
                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full py-2.5 rounded-xl bg-slate-900 border border-[#00E5FF]/40 text-slate-200 font-arcade text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-[#00E5FF]" />
                    <span>RESET PROGRESS</span>
                  </button>
                ) : (
                  <div className="space-y-2 text-center">
                    <p className="text-xs text-[#00E5FF] font-bold">
                      ¿Seguro que quieres borrar todo tu progreso guardado?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleConfirmReset}
                        className="py-2 rounded-xl bg-[#00FF66] text-[#050811] font-arcade text-xs font-black cursor-pointer"
                      >
                        SÍ, BORRAR
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="py-2 rounded-xl bg-slate-800 text-slate-200 font-arcade text-xs font-bold cursor-pointer"
                      >
                        CANCELAR
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-3 rounded-2xl bg-[#00E5FF] text-[#050811] font-arcade text-sm font-black cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
