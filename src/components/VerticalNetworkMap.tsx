import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SaveData } from '../types/game';
import { WORLDS_DATA } from '../data/worlds';
import { LEVELS_DATA, getLevelById } from '../data/levels';
import { getLevelProgress, getWorldStats, getGlobalStats } from '../systems/storage';
import { CharacterIllustration } from './CharacterIllustration';
import { AudioSystem } from '../systems/audio';
import { Home, Settings, Lock, Play, Check, Sparkles, X } from 'lucide-react';

interface VerticalNetworkMapProps {
  saveData: SaveData;
  transitionFromLevelId: number | null;
  transitionToLevelId: number | null;
  onClearTransition: () => void;
  onSelectPlayLevel: (levelId: number) => void;
  onGoHome: () => void;
  onOpenSettings: () => void;
}

interface NodeCoord {
  levelId: number;
  worldId: number;
  levelInWorld: number;
  x: number; // 0..480 SVG coordinate space
  y: number; // 0..3800 SVG coordinate space
}

interface IslandCoord {
  worldId: number;
  centerX: number;
  centerY: number;
  nodes: NodeCoord[];
}

const MAP_WIDTH = 480;
const MAP_HEIGHT = 3750;

export const VerticalNetworkMap: React.FC<VerticalNetworkMapProps> = ({
  saveData,
  transitionFromLevelId,
  transitionToLevelId,
  onClearTransition,
  onSelectPlayLevel,
  onGoHome,
  onOpenSettings,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Nivel seleccionado para mostrar el pequeño modal limpio (LEVEL XX + Nombre + PLAY)
  const [selectedModalLevelId, setSelectedModalLevelId] = useState<number | null>(null);

  // Estado de animación de The Hacker desplazándose entre nodos tras completar un nivel
  const [hackerCoords, setHackerCoords] = useState<{ x: number; y: number } | null>(null);
  const [isAnimatingMove, setIsAnimatingMove] = useState<boolean>(false);
  const [worldUnlockedBanner, setWorldUnlockedBanner] = useState<{
    restoredText: string;
    unlockedText: string;
  } | null>(null);

  // Calculamos las coordenadas geométricas de las 7 Islas Digitales (de arriba hacia abajo: Mundo 1 arriba, scroll down hasta Mundo 7 abajo)
  const islands: IslandCoord[] = useMemo(() => {
    return WORLDS_DATA.map((world, idx) => {
      // idx 0 (World 1) arriba del todo (~260), idx 6 (World 7) abajo (~3320)
      const centerY = 260 + idx * 510;
      // Curva orgánica suave izquierda-derecha para las islas
      const centerX =
        world.id === 7
          ? 240
          : idx % 2 === 0
          ? 215
          : 265;

      // Los 5 niveles dentro de cada isla forman un recorrido descendente 1 -> 2 -> 3 -> 4 -> 5 sobre la plataforma
      const relativeOffsets: Array<{ dx: number; dy: number }> = [
        { dx: -78, dy: -74 }, // Nivel 1 (entrada superior de la isla)
        { dx: 52, dy: -38 },  // Nivel 2
        { dx: -48, dy: 2 },   // Nivel 3 (centro de la isla)
        { dx: 64, dy: 40 },   // Nivel 4
        { dx: -10, dy: 76 },  // Nivel 5 (salida inferior hacia el siguiente mundo)
      ];

      const nodes: NodeCoord[] = relativeOffsets.map((off, nIdx) => {
        const levelInWorld = nIdx + 1;
        const levelId = (world.id - 1) * 5 + levelInWorld;
        return {
          levelId,
          worldId: world.id,
          levelInWorld,
          x: centerX + off.dx,
          y: centerY + off.dy,
        };
      });

      return {
        worldId: world.id,
        centerX,
        centerY,
        nodes,
      };
    });
  }, []);

  const allNodesMap = useMemo(() => {
    const map: Record<number, NodeCoord> = {};
    islands.forEach((isl) => {
      isl.nodes.forEach((n) => {
        map[n.levelId] = n;
      });
    });
    return map;
  }, [islands]);

  // Nivel actual donde se sitúa The Hacker (último nivel desbloqueado)
  const activeLevelId = Math.min(35, Math.max(1, saveData.unlockedLevel));
  const activeLevelConfig = getLevelById(activeLevelId);
  const globalStats = getGlobalStats(saveData);

  // Centrar automáticamente la cámara vertical en la posición actual de The Hacker
  const scrollToNode = (levelId: number, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    const coord = allNodesMap[levelId];
    if (!container || !coord) return;

    const scaleRatio = container.scrollHeight / MAP_HEIGHT;
    const targetScrollTop =
      coord.y * scaleRatio - container.clientHeight * 0.52;
    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior,
    });
  };

  // Efecto al entrar al mapa o cuando acaba de completarse un nivel (animación de avance de The Hacker)
  useEffect(() => {
    if (
      transitionFromLevelId &&
      transitionToLevelId &&
      allNodesMap[transitionFromLevelId] &&
      allNodesMap[transitionToLevelId]
    ) {
      const fromCoord = allNodesMap[transitionFromLevelId];
      const toCoord = allNodesMap[transitionToLevelId];
      const completedLevel = getLevelById(transitionFromLevelId);

      // 1. Situar inicialmente a The Hacker en el nodo recién completado y centrar cámara
      setHackerCoords({ x: fromCoord.x, y: fromCoord.y });
      setIsAnimatingMove(true);
      setSelectedModalLevelId(null);

      setTimeout(() => {
        scrollToNode(transitionFromLevelId, 'auto');
      }, 40);

      // Si completó el nivel 5 de un mundo, mostrar aviso de desbloqueo de la siguiente isla
      if (completedLevel.levelInWorld === 5 && completedLevel.worldCompleteBanner) {
        setWorldUnlockedBanner(completedLevel.worldCompleteBanner);
        AudioSystem.worldTransition();
      }

      // 2. Desplazar a The Hacker suavemente hacia el nuevo nodo desbloqueado
      const moveTimer = window.setTimeout(() => {
        setHackerCoords({ x: toCoord.x, y: toCoord.y });
        scrollToNode(transitionToLevelId, 'smooth');
        AudioSystem.unlock();
      }, 420);

      // 3. Finalizar transición y abrir la tarjeta del siguiente nivel lista para jugar
      const endTimer = window.setTimeout(() => {
        setIsAnimatingMove(false);
        setWorldUnlockedBanner(null);
        setSelectedModalLevelId(transitionToLevelId);
        onClearTransition();
      }, 1650);

      return () => {
        clearTimeout(moveTimer);
        clearTimeout(endTimer);
      };
    } else {
      // Apertura normal del mapa: situar a The Hacker directamente en su nivel actual y centrar cámara
      const currentCoord = allNodesMap[activeLevelId];
      if (currentCoord) {
        setHackerCoords({ x: currentCoord.x, y: currentCoord.y });
      }
      setTimeout(() => {
        scrollToNode(activeLevelId, 'auto');
      }, 50);
    }
  }, [
    transitionFromLevelId,
    transitionToLevelId,
    activeLevelId,
    allNodesMap,
    onClearTransition,
  ]);

  // Nodos de fondo decorativos de la gran red digital
  const backgroundNetNodes = useMemo(() => {
    const pts: Array<{ x: number; y: number; r: number; pulseDelay: number }> = [];
    for (let i = 0; i < 68; i++) {
      const seed = (i + 1) * 97;
      pts.push({
        x: 24 + (seed % (MAP_WIDTH - 48)),
        y: 80 + ((seed * 31) % (MAP_HEIGHT - 160)),
        r: 2 + (i % 3),
        pulseDelay: (i % 7) * 0.4,
      });
    }
    return pts;
  }, []);

  const selectedLevelConfig = selectedModalLevelId ? getLevelById(selectedModalLevelId) : null;
  const selectedLevelProgress = selectedModalLevelId
    ? getLevelProgress(saveData, selectedModalLevelId)
    : null;

  return (
    <div className="relative w-full h-full flex flex-col justify-between bg-[#030712] overflow-hidden select-none">
      {/* =====================================================================
          18 y 19. CABECERA MÍNIMA DEL MAPA (HOME + PROGRESO GENERAL + RECURSOS + SETTINGS)
         ===================================================================== */}
      <header className="w-full px-3.5 py-2.5 bg-[#060D1F]/95 backdrop-blur-md border-b border-[#00E5FF]/30 flex items-center justify-between gap-2 z-30 shrink-0 shadow-[0_4px_24px_rgba(0,0,0,0.7)]">
        {/* Botón HOME */}
        <button
          onClick={onGoHome}
          aria-label="Home"
          className="p-2.5 rounded-2xl bg-[#0A162E] border border-[#00E5FF]/50 text-[#00E5FF] active:scale-95 transition cursor-pointer"
        >
          <Home className="w-4 h-4" />
        </button>

        {/* Progreso General discreto: WORLD X/7 · LEVEL Y/35 + 🪙 BYTECOINS + 💾 DATA CORES */}
        <div className="flex flex-col items-center text-center min-w-0">
          <div className="flex items-center gap-2 font-mono-tech text-[11px] font-extrabold tracking-wider">
            <span className="text-[#00E5FF]">WORLD {activeLevelConfig.worldId} / 7</span>
            <span className="text-slate-600">·</span>
            <span className="text-[#00FF66]">LEVEL {activeLevelId} / 35</span>
          </div>
          <div className="flex items-center gap-3 font-mono-tech text-xs font-extrabold mt-0.5">
            <span className="text-[#00E5FF]">🪙 {saveData.totalBytecoins}</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#00FF66]">💾 {globalStats.totalDataCores}</span>
            <span className="text-slate-600">|</span>
            <span className="text-white">⭐ {globalStats.totalStars}</span>
          </div>
        </div>

        {/* Botón SETTINGS */}
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="p-2.5 rounded-2xl bg-[#0A162E] border border-[#00E5FF]/50 text-[#00E5FF] active:scale-95 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* =====================================================================
          17. CONTENEDOR VERTICAL CON SCROLL (SWIPE UP / SWIPE DOWN)
         ===================================================================== */}
      <div
        ref={scrollContainerRef}
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        className="relative flex-1 w-full overflow-y-auto overflow-x-hidden bg-[#030712]"
      >
        {/* Lienzo Vertical Proporcional del Universo Digital */}
        <div
          className="relative w-full mx-auto"
          style={{
            height: `${MAP_HEIGHT}px`,
            maxWidth: `${MAP_WIDTH}px`,
          }}
        >
          {/* CAPA SVG DE LA GRAN RED DIGITAL, ISLAS TECNOLÓGICAS Y CONEXIONES */}
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Gradiente Espacial Digital Profundo */}
              <linearGradient id="netBgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#02050D" />
                <stop offset="25%" stopColor="#061229" />
                <stop offset="60%" stopColor="#040B1A" />
                <stop offset="100%" stopColor="#030712" />
              </linearGradient>

              {/* Gradiente Isla Desbloqueada */}
              <linearGradient id="islandActiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0D2247" />
                <stop offset="55%" stopColor="#08152E" />
                <stop offset="100%" stopColor="#050C1C" />
              </linearGradient>

              {/* Gradiente Isla Completada */}
              <linearGradient id="islandCompletedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#092938" />
                <stop offset="55%" stopColor="#081B33" />
                <stop offset="100%" stopColor="#051020" />
              </linearGradient>

              {/* Gradiente Isla Bloqueada */}
              <linearGradient id="islandLockedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#090E1A" />
                <stop offset="100%" stopColor="#050811" />
              </linearGradient>

              {/* Filtro de Resplandor Eléctrico */}
              <filter id="glowBlue" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Fondo Global de Red Digital */}
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#netBgGrad)" />

            {/* Retícula Tecnológica Sutil de Profundidad */}
            <g stroke="#00E5FF" strokeOpacity="0.05" strokeWidth="1">
              {Array.from({ length: 12 }).map((_, i) => (
                <line
                  key={`vline-${i}`}
                  x1={i * 44}
                  y1={0}
                  x2={i * 44}
                  y2={MAP_HEIGHT}
                />
              ))}
              {Array.from({ length: 75 }).map((_, i) => (
                <line
                  key={`hline-${i}`}
                  x1={0}
                  y1={i * 50}
                  x2={MAP_WIDTH}
                  y2={i * 50}
                />
              ))}
            </g>

            {/* Constelación de Nodos y Conexiones de Fondo (Efecto Red Neuronal / Tecnológica) */}
            <g>
              {backgroundNetNodes.map((pt, idx) => {
                const nextPt = backgroundNetNodes[(idx + 1) % backgroundNetNodes.length];
                const altPt = backgroundNetNodes[(idx + 3) % backgroundNetNodes.length];
                const dist1 = Math.hypot(pt.x - nextPt.x, pt.y - nextPt.y);
                const dist2 = Math.hypot(pt.x - altPt.x, pt.y - altPt.y);
                return (
                  <g key={`bgnet-${idx}`}>
                    {dist1 < 220 && (
                      <line
                        x1={pt.x}
                        y1={pt.y}
                        x2={nextPt.x}
                        y2={nextPt.y}
                        stroke="#00E5FF"
                        strokeOpacity="0.11"
                        strokeWidth="1"
                      />
                    )}
                    {dist2 < 190 && (
                      <line
                        x1={pt.x}
                        y1={pt.y}
                        x2={altPt.x}
                        y2={altPt.y}
                        stroke="#00FF66"
                        strokeOpacity="0.08"
                        strokeWidth="1"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.r}
                      fill={idx % 3 === 0 ? '#00FF66' : '#00E5FF'}
                      fillOpacity="0.35"
                    />
                  </g>
                );
              })}
            </g>

            {/* =================================================================
                15. CONEXIONES ENTRE LOS 7 MUNDOS (GRANDES HACES DE DATOS ENTRE ISLAS)
               ================================================================= */}
            {islands.map((island, idx) => {
              if (idx === islands.length - 1) return null;
              const nextIsland = islands[idx + 1];
              const topNodeCurrent = island.nodes[4]; // Nivel 5 de la isla actual
              const bottomNodeNext = nextIsland.nodes[0]; // Nivel 1 de la siguiente isla
              const isBridgeUnlocked = nextIsland.worldId <= saveData.unlockedWorld;

              const midY = (topNodeCurrent.y + bottomNodeNext.y) / 2;
              const ctrlX1 = topNodeCurrent.x + (idx % 2 === 0 ? 55 : -55);
              const ctrlX2 = bottomNodeNext.x + (idx % 2 === 0 ? -45 : 45);
              const pathD = `M ${topNodeCurrent.x} ${topNodeCurrent.y} C ${ctrlX1} ${midY - 30}, ${ctrlX2} ${midY + 30}, ${bottomNodeNext.x} ${bottomNodeNext.y}`;

              return (
                <g key={`world-bridge-${island.worldId}`}>
                  {/* Cable exterior de datos */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isBridgeUnlocked ? '#00E5FF' : '#1E293B'}
                    strokeOpacity={isBridgeUnlocked ? 0.35 : 0.3}
                    strokeWidth={isBridgeUnlocked ? 12 : 6}
                    strokeLinecap="round"
                  />
                  {/* Haz central de energía */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isBridgeUnlocked ? '#00FF66' : '#334155'}
                    strokeOpacity={isBridgeUnlocked ? 0.9 : 0.35}
                    strokeWidth={isBridgeUnlocked ? 3.5 : 2}
                    strokeDasharray={isBridgeUnlocked ? '10 8' : '6 8'}
                  />
                  {/* Nodos intermedios de retransmisión en el puente */}
                  <circle
                    cx={(topNodeCurrent.x + bottomNodeNext.x) / 2}
                    cy={midY}
                    r={isBridgeUnlocked ? 6 : 4}
                    fill={isBridgeUnlocked ? '#00E5FF' : '#1E293B'}
                    stroke="#050811"
                    strokeWidth="2"
                  />
                </g>
              );
            })}

            {/* =================================================================
                5, 10 y 16. LAS 7 GRANDES ISLAS DIGITALES FLOTANTES
               ================================================================= */}
            {islands.map((island) => {
              const world = WORLDS_DATA.find((w) => w.id === island.worldId)!;
              const stats = getWorldStats(saveData, island.worldId);
              const isUnlocked = island.worldId <= saveData.unlockedWorld;
              const isCompleted = stats.completedCount === 5;
              const isDigitalCore = island.worldId === 7;

              const cx = island.centerX;
              const cy = island.centerY;

              const strokeMain = isCompleted
                ? '#00FF66'
                : isUnlocked
                ? '#00E5FF'
                : '#1E293B';

              const fillGrad = isCompleted
                ? 'url(#islandCompletedGrad)'
                : isUnlocked
                ? 'url(#islandActiveGrad)'
                : 'url(#islandLockedGrad)';

              return (
                <g key={`island-group-${island.worldId}`}>
                  {/* 16. Presencia especial para WORLD 7 — THE DIGITAL CORE */}
                  {isDigitalCore && (
                    <g>
                      {/* Red convergente densa hacia el Digital Core */}
                      {Array.from({ length: 12 }).map((_, rayIdx) => {
                        const angle = (Math.PI * 2 * rayIdx) / 12;
                        const rOut = 215;
                        return (
                          <line
                            key={`core-ray-${rayIdx}`}
                            x1={cx}
                            y1={cy}
                            x2={cx + Math.cos(angle) * rOut}
                            y2={cy + Math.sin(angle) * rOut}
                            stroke={isUnlocked ? '#00E5FF' : '#1E293B'}
                            strokeOpacity={isUnlocked ? 0.25 : 0.12}
                            strokeWidth="1.5"
                            strokeDasharray="6 6"
                          />
                        );
                      })}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={185}
                        fill="none"
                        stroke={isUnlocked ? '#00FF66' : '#1E293B'}
                        strokeOpacity={isUnlocked ? 0.35 : 0.15}
                        strokeWidth="2"
                        strokeDasharray="12 8"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={155}
                        fill="none"
                        stroke={isUnlocked ? '#00E5FF' : '#1E293B'}
                        strokeOpacity={isUnlocked ? 0.45 : 0.2}
                        strokeWidth="2.5"
                      />
                    </g>
                  )}

                  {/* Halo / Corona Digital para islas COMPLETADAS o DESBLOQUEADAS */}
                  {isUnlocked && (
                    <ellipse
                      cx={cx}
                      cy={cy + 15}
                      rx={168}
                      ry={125}
                      fill={isCompleted ? '#00FF66' : '#00E5FF'}
                      fillOpacity={isCompleted ? 0.11 : 0.08}
                    />
                  )}

                  {/* Base / Sub-estructura Tecnológica Flotante (Efecto 3D de Isla de Datos) */}
                  <polygon
                    points={`
                      ${cx - 140},${cy + 20}
                      ${cx - 95},${cy + 115}
                      ${cx},${cy + 142}
                      ${cx + 95},${cy + 115}
                      ${cx + 140},${cy + 20}
                    `}
                    fill="#040915"
                    stroke={strokeMain}
                    strokeOpacity={isUnlocked ? 0.55 : 0.25}
                    strokeWidth="2"
                  />

                  {/* Líneas de energía verticales bajo la isla flotante */}
                  <line
                    x1={cx - 60}
                    y1={cy + 100}
                    x2={cx - 60}
                    y2={cy + 155}
                    stroke={strokeMain}
                    strokeOpacity={isUnlocked ? 0.5 : 0.15}
                    strokeWidth="2"
                  />
                  <line
                    x1={cx}
                    y1={cy + 125}
                    x2={cx}
                    y2={cy + 180}
                    stroke={isCompleted ? '#00FF66' : strokeMain}
                    strokeOpacity={isUnlocked ? 0.7 : 0.15}
                    strokeWidth="3"
                  />
                  <line
                    x1={cx + 60}
                    y1={cy + 100}
                    x2={cx + 60}
                    y2={cy + 155}
                    stroke={strokeMain}
                    strokeOpacity={isUnlocked ? 0.5 : 0.15}
                    strokeWidth="2"
                  />

                  {/* Plataforma Principal de la Isla Digital (Polígono Futurista de Nodos) */}
                  <polygon
                    points={`
                      ${cx},${cy - 118}
                      ${cx + 122},${cy - 68}
                      ${cx + 148},${cy + 16}
                      ${cx + 98},${cy + 102}
                      ${cx},${cy + 122}
                      ${cx - 98},${cy + 102}
                      ${cx - 148},${cy + 16}
                      ${cx - 122},${cy - 68}
                    `}
                    fill={fillGrad}
                    stroke={strokeMain}
                    strokeOpacity={isUnlocked ? 0.95 : 0.35}
                    strokeWidth={isCompleted || isDigitalCore ? 3.5 : 2.5}
                  />

                  {/* Anillo de Circuito Interno en la Superficie de la Isla */}
                  <polygon
                    points={`
                      ${cx},${cy - 96}
                      ${cx + 98},${cy - 52}
                      ${cx + 120},${cy + 12}
                      ${cx + 78},${cy + 82}
                      ${cx},${cy + 98}
                      ${cx - 78},${cy + 82}
                      ${cx - 120},${cy + 12}
                      ${cx - 98},${cy - 52}
                    `}
                    fill="none"
                    stroke={isCompleted ? '#00FF66' : '#00E5FF'}
                    strokeOpacity={isUnlocked ? 0.3 : 0.08}
                    strokeWidth="1.5"
                    strokeDasharray="8 6"
                  />

                  {/* Corona Digital si el Mundo está COMPLETADO (5/5) */}
                  {isCompleted && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={142}
                      fill="none"
                      stroke="#00FF66"
                      strokeOpacity="0.45"
                      strokeWidth="2"
                      strokeDasharray="14 6"
                    />
                  )}

                  {/* =============================================================
                      14. CONEXIONES INTERNAS ENTRE LOS 5 NIVELES DE LA ISLA (1->2->3->4->5)
                     ============================================================= */}
                  {island.nodes.map((node, nIdx) => {
                    if (nIdx === island.nodes.length - 1) return null;
                    const nextNode = island.nodes[nIdx + 1];
                    const nextUnlocked = nextNode.levelId <= saveData.unlockedLevel;

                    return (
                      <g key={`lvl-edge-${node.levelId}`}>
                        {/* Sombra de pista */}
                        <line
                          x1={node.x}
                          y1={node.y}
                          x2={nextNode.x}
                          y2={nextNode.y}
                          stroke={nextUnlocked ? '#00E5FF' : '#1E293B'}
                          strokeOpacity={nextUnlocked ? 0.4 : 0.45}
                          strokeWidth={nextUnlocked ? 7 : 4}
                          strokeLinecap="round"
                        />
                        {/* Línea de circuito luminosa */}
                        <line
                          x1={node.x}
                          y1={node.y}
                          x2={nextNode.x}
                          y2={nextNode.y}
                          stroke={nextUnlocked ? '#00FF66' : '#334155'}
                          strokeOpacity={nextUnlocked ? 0.95 : 0.4}
                          strokeWidth={nextUnlocked ? 2.8 : 1.5}
                          strokeDasharray={nextUnlocked ? 'none' : '5 5'}
                          strokeLinecap="round"
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* =================================================================
              11. ETIQUETAS DE CADA MUNDO + 6, 7 y 13. NODOS INTERACTIVOS DE LOS 35 NIVELES
             ================================================================= */}
          {islands.map((island) => {
            const world = WORLDS_DATA.find((w) => w.id === island.worldId)!;
            const stats = getWorldStats(saveData, island.worldId);
            const isUnlocked = island.worldId <= saveData.unlockedWorld;
            const isCompleted = stats.completedCount === 5;
            const worldNumFormatted = String(world.id).padStart(2, '0');

            return (
              <React.Fragment key={`ui-island-${island.worldId}`}>
                {/* Etiqueta del Mundo debajo de su Isla Digital: "01 — THE COMPUTER" */}
                <div
                  style={{
                    left: `${(island.centerX / MAP_WIDTH) * 100}%`,
                    top: `${island.centerY + 132}px`,
                  }}
                  className="-translate-x-1/2 absolute z-10 flex flex-col items-center text-center pointer-events-none w-64"
                >
                  <div
                    className={`px-3.5 py-1 rounded-full border backdrop-blur-xs font-mono-tech text-xs font-extrabold tracking-wider shadow-lg ${
                      isCompleted
                        ? 'bg-[#062019]/95 border-[#00FF66] text-[#00FF66]'
                        : isUnlocked
                        ? 'bg-[#07152E]/95 border-[#00E5FF] text-[#00E5FF]'
                        : 'bg-[#070B14]/90 border-slate-800 text-slate-500'
                    }`}
                  >
                    {worldNumFormatted} — {world.name}
                  </div>

                  {/* Estado de progreso del mundo (5/5 completado o estrellas) */}
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono-tech">
                    {isCompleted ? (
                      <span className="text-[#00FF66] font-extrabold">
                        ✓ SYSTEM RESTORED (5/5) · ⭐ {stats.starsEarned}/15
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-slate-300 font-bold">
                        NIVELES: {stats.completedCount}/5 · ⭐ {stats.starsEarned}/15
                      </span>
                    ) : (
                      <span className="text-slate-600 font-bold">🔒 BLOQUEADO</span>
                    )}
                  </div>
                </div>

                {/* Los 5 Nodos Numerados (1..5) de la Isla */}
                {island.nodes.map((node) => {
                  const lvlProg = getLevelProgress(saveData, node.levelId);
                  const isNodeUnlocked = node.levelId <= saveData.unlockedLevel;
                  const isNodeCompleted = lvlProg.completed;
                  const isNodeCurrent = node.levelId === activeLevelId;

                  return (
                    <div
                      key={`node-btn-${node.levelId}`}
                      style={{
                        left: `${(node.x / MAP_WIDTH) * 100}%`,
                        top: `${node.y}px`,
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                    >
                      {/* Anillo de pulso para el nivel actual */}
                      {isNodeCurrent && (
                        <span className="absolute -inset-2 rounded-full bg-[#00FF66]/30 animate-ping pointer-events-none" />
                      )}

                      <button
                        ref={(el) => {
                          nodeRefs.current[node.levelId] = el;
                        }}
                        onClick={() => {
                          if (isNodeUnlocked) {
                            AudioSystem.bytecoin();
                            setSelectedModalLevelId(node.levelId);
                          }
                        }}
                        className={`relative w-11 h-11 rounded-full font-arcade text-sm font-black flex items-center justify-center transition-transform ${
                          isNodeCurrent
                            ? 'bg-[#00FF66] text-[#050811] border-2 border-white scale-110 shadow-[0_0_22px_#00FF66] cursor-pointer'
                            : isNodeCompleted
                            ? 'bg-[#09243C] text-[#00E5FF] border-2 border-[#00FF66] shadow-[0_0_14px_rgba(0,229,255,0.5)] cursor-pointer hover:scale-105'
                            : isNodeUnlocked
                            ? 'bg-[#0B1E3D] text-white border-2 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.6)] cursor-pointer hover:scale-105'
                            : 'bg-[#080D1A] text-slate-600 border-2 border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        {isNodeUnlocked ? (
                          <span>{node.levelInWorld}</span>
                        ) : (
                          <Lock className="w-4 h-4 text-slate-500" />
                        )}

                        {/* Marca de check en niveles completados */}
                        {isNodeCompleted && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00FF66] text-[#050811] flex items-center justify-center shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </button>

                      {/* Estrellas conseguidas bajo el nodo completado */}
                      {isNodeCompleted && lvlProg.stars > 0 && (
                        <div className="mt-0.5 px-1.5 py-0.2 rounded-full bg-[#050811]/90 border border-[#00E5FF]/30 text-[9px] leading-tight tracking-tighter pointer-events-none">
                          {'⭐'.repeat(lvlProg.stars)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* =================================================================
              8 y 9. THE HACKER FÍSICAMENTE SOBRE EL MAPA (JUNTO AL NIVEL ACTUAL)
             ================================================================= */}
          {hackerCoords && (
            <div
              style={{
                left: `${(hackerCoords.x / MAP_WIDTH) * 100}%`,
                top: `${hackerCoords.y - 46}px`,
                transition: isAnimatingMove
                  ? 'left 1.05s cubic-bezier(0.22, 1, 0.36, 1), top 1.05s cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none flex flex-col items-center"
            >
              <div className="px-2 py-0.5 rounded-full bg-[#00FF66] text-[#050811] font-mono-tech text-[9px] font-black tracking-wider shadow-md mb-0.5">
                HACKER
              </div>
              <CharacterIllustration
                size={68}
                className="drop-shadow-[0_0_14px_rgba(0,255,102,0.8)]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Banner flotante cuando se desbloquea una nueva Isla/Mundo en el mapa */}
      {worldUnlockedBanner && (
        <div className="fixed top-20 inset-x-4 max-w-sm mx-auto z-40 rounded-3xl bg-[#07152E]/95 border-2 border-[#00FF66] p-4 text-center shadow-2xl matrix-glow pointer-events-none">
          <div className="inline-flex items-center gap-1 text-xs font-mono-tech font-extrabold text-[#00FF66]">
            <Sparkles className="w-4 h-4" />
            <span>{worldUnlockedBanner.restoredText}</span>
          </div>
          <div className="font-arcade text-xl font-black text-white text-electric-glow mt-0.5">
            {worldUnlockedBanner.unlockedText}
          </div>
        </div>
      )}

      {/* =====================================================================
          12. MODAL COMPACTO DE INFORMACIÓN DE NIVEL AL TOCAR UN NODO DESBLOQUEADO
         ===================================================================== */}
      {selectedLevelConfig && selectedLevelProgress && (
        <div
          onClick={() => setSelectedModalLevelId(null)}
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#081329] border-2 border-[#00E5FF] p-5 space-y-3.5 electric-glow animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-[#00E5FF]/15 border border-[#00E5FF]/50 font-mono-tech text-xs font-extrabold text-[#00E5FF]">
                LEVEL {String(selectedLevelConfig.id).padStart(2, '0')}
              </span>

              <button
                onClick={() => setSelectedModalLevelId(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <div className="font-mono-tech text-[11px] font-bold text-[#00FF66]">
                0{selectedLevelConfig.worldId} —{' '}
                {WORLDS_DATA.find((w) => w.id === selectedLevelConfig.worldId)?.name} (
                {selectedLevelConfig.levelInWorld}/5)
              </div>
              <h3 className="font-arcade text-2xl font-black text-white text-electric-glow">
                {selectedLevelConfig.name}
              </h3>
            </div>

            {/* Indicadores limpios: 🪙 Bytecoins | 💾 Data Cores | ⭐⭐⭐ Mejor puntuación */}
            <div className="grid grid-cols-3 gap-2 bg-[#050811] p-3 rounded-2xl border border-[#00E5FF]/30 font-mono-tech text-center">
              <div>
                <div className="text-[10px] text-slate-400">BYTECOINS</div>
                <div className="text-xs font-extrabold text-[#00E5FF]">
                  🪙 +{selectedLevelConfig.bytecoins}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">DATA CORES</div>
                <div className="text-xs font-extrabold text-[#00FF66]">
                  💾 {selectedLevelProgress.dataCoresCollected.filter(Boolean).length}/3
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">BEST SCORE</div>
                <div className="text-xs font-extrabold text-white">
                  {selectedLevelProgress.stars > 0
                    ? '⭐'.repeat(selectedLevelProgress.stars)
                    : '☆☆☆'}{' '}
                  {selectedLevelProgress.bestScore > 0 ? selectedLevelProgress.bestScore : ''}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const targetId = selectedLevelConfig.id;
                setSelectedModalLevelId(null);
                onSelectPlayLevel(targetId);
              }}
              className="w-full py-3.5 rounded-2xl bg-[#00FF66] hover:bg-[#1aff75] text-[#050811] font-arcade text-lg font-black tracking-wider shadow-[0_0_20px_rgba(0,255,102,0.45)] flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
