import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LevelConfig, EnemyType, LevelCompletionSummary } from '../types/game';
import { WORLDS_DATA } from '../data/worlds';
import { ASSETS_CONFIG, getLoadedImage } from '../config/assets';
import { AudioSystem } from '../systems/audio';
import { Home, Pause, Play, RotateCcw } from 'lucide-react';

interface GameCanvasProps {
  level: LevelConfig;
  initialTotalBytecoins: number;
  initialBestDataCores: [boolean, boolean, boolean];
  onLevelComplete: (summary: LevelCompletionSummary) => void;
  onExitToMap: () => void;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  isFirewallScenario?: boolean;
}

interface PhaseBlockObstacle {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cycleDuration: number; // segundos totales del ciclo
  openRatio: number; // fracción del ciclo en la que se puede atravesar (ej. 0.52)
  phaseOffset: number;
  isFirewallTheme: boolean;
}

interface EnemyEntity {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  vx: number;
  baseY: number;
  floatPhase: number;
  stunnedTimer: number;
}

interface CoinEntity {
  id: number;
  x: number;
  y: number;
  value: number;
  collected: boolean;
}

interface DataCoreEntity {
  index: 0 | 1 | 2;
  x: number;
  y: number;
  collected: boolean;
}

interface CheckpointEntity {
  id: number;
  x: number;
  y: number;
  activated: boolean;
}

interface MissionNodeEntity {
  id: number;
  x: number;
  y: number;
  activated: boolean;
  label: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  initialTotalBytecoins,
  initialBestDataCores,
  onLevelComplete,
  onExitToMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados reactivos para el HUD limpio y claro
  const [lives, setLives] = useState<number>(5);
  const [sessionBytecoins, setSessionBytecoins] = useState<number>(0);
  const [dataCoresMask, setDataCoresMask] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [connectionLostBanner, setConnectionLostBanner] = useState<boolean>(false);
  const [checkpointBanner, setCheckpointBanner] = useState<string | null>(null);
  const [showObjectiveToast, setShowObjectiveToast] = useState<boolean>(true);
  const [activeTouch, setActiveTouch] = useState<{ left: boolean; right: boolean; jump: boolean }>({
    left: false,
    right: false,
    jump: false,
  });

  // Referencias mutables para el bucle a 60 FPS
  const inputRef = useRef({ left: false, right: false, jump: false, jumpJustPressed: false });
  const pausedRef = useRef(false);
  const completedRef = useRef(false);
  const connectionLostRef = useRef(false);

  const worldConfig = WORLDS_DATA.find((w) => w.id === level.worldId) || WORLDS_DATA[0];

  // Mostrar el objetivo durante suficiente tiempo (14 segundos) al iniciar el nivel
  useEffect(() => {
    setShowObjectiveToast(true);
    const t = window.setTimeout(() => setShowObjectiveToast(false), 14000);
    return () => clearTimeout(t);
  }, [level.id]);

  // Sincronizar pausa
  const togglePause = useCallback(() => {
    if (connectionLostRef.current || completedRef.current) return;
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
  }, []);

  // Controles de teclado opcionales para pruebas sin depender de ellos
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        inputRef.current.left = true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        inputRef.current.right = true;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (!inputRef.current.jump) {
          inputRef.current.jumpJustPressed = true;
        }
        inputRef.current.jump = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        togglePause();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        inputRef.current.left = false;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        inputRef.current.right = false;
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        inputRef.current.jump = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [togglePause]);

  // Motor principal de juego 2D a 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reiniciar estados al cargar el nivel
    setLives(5);
    setSessionBytecoins(0);
    setDataCoresMask([false, false, false]);
    setIsPaused(false);
    setConnectionLostBanner(false);
    pausedRef.current = false;
    completedRef.current = false;
    connectionLostRef.current = false;

    const VIEW_W = 480;
    const VIEW_H = 640;
    const GROUND_Y = 520;

    // Generación determinista del nivel basada en level.id y dificultad
    const segCount = 9 + level.difficulty * 2; // 11 a 19 tramos lineales
    const platforms: Platform[] = [];
    const phaseBlocks: PhaseBlockObstacle[] = [];
    const enemies: EnemyEntity[] = [];
    const coins: CoinEntity[] = [];
    const dataCores: DataCoreEntity[] = [];
    const checkpoints: CheckpointEntity[] = [];
    const missionNodes: MissionNodeEntity[] = [];
    const particles: Particle[] = [];

    // Plataforma inicial amplia y segura
    platforms.push({ x: 0, y: GROUND_Y, w: 420, h: 120 });

    let cursorX = 420;
    const checkpointIndices = [Math.floor(segCount * 0.35), Math.floor(segCount * 0.7)];
    const dataCoreIndices = [
      Math.floor(segCount * 0.25),
      Math.floor(segCount * 0.55),
      Math.floor(segCount * 0.82),
    ];
    const missionNodeIndices = [
      Math.floor(segCount * 0.3),
      Math.floor(segCount * 0.6),
      Math.floor(segCount * 0.88),
    ];

    // Reparto exacto del valor de Bytecoins del nivel entre las monedas del recorrido
    const totalCoinsCount = 10;
    const coinValue = Math.max(1, Math.floor(level.bytecoins / totalCoinsCount));
    let remainingCoinsValue = level.bytecoins;

    for (let i = 0; i < segCount; i++) {
      const seed = level.id * 37 + i * 19;
      const gap = 75 + (seed % 35);
      cursorX += gap;

      const platW = 250 + ((seed * 7) % 110);
      const heightStep = (i % 3 === 1 ? -55 : i % 3 === 2 ? -95 : 0);
      const platY = GROUND_Y + heightStep;

      platforms.push({
        x: cursorX,
        y: platY,
        w: platW,
        h: VIEW_H - platY + 100,
      });

      // Plataforma elevada opcional para los 3 Data Cores
      const dcIndex = dataCoreIndices.indexOf(i);
      if (dcIndex !== -1) {
        const highY = platY - 115;
        platforms.push({
          x: cursorX + 45,
          y: highY,
          w: 130,
          h: 22,
        });
        dataCores.push({
          index: dcIndex as 0 | 1 | 2,
          x: cursorX + 110,
          y: highY - 34,
          collected: false,
        });
      }

      // Checkpoints
      if (checkpointIndices.includes(i)) {
        checkpoints.push({
          id: i,
          x: cursorX + 55,
          y: platY,
          activated: false,
        });
      }

      // Nodos de misión del nivel
      const mIdx = missionNodeIndices.indexOf(i);
      if (mIdx !== -1) {
        missionNodes.push({
          id: mIdx + 1,
          x: cursorX + platW - 55,
          y: platY,
          activated: false,
          label: `NODE 0${mIdx + 1}`,
        });
      }

      // ÚNICO TIPO DE OBSTÁCULO: Bloques que requieren esperar al momento adecuado para atravesarlos
      if (i % 2 === 1) {
        const cycleDuration = Math.max(2.2, 3.6 - level.difficulty * 0.22);
        const openRatio = Math.max(0.45, 0.62 - level.difficulty * 0.03);
        phaseBlocks.push({
          id: i,
          x: cursorX + Math.floor(platW * 0.46),
          y: platY - 108,
          w: 44,
          h: 108,
          cycleDuration,
          openRatio,
          phaseOffset: (i * 0.7) % cycleDuration,
          isFirewallTheme: level.worldId === 4,
        });
      } else if (i > 0 && level.enemies.length > 0) {
        // Enemigo patrullando el tramo
        const enemyType = level.enemies[i % level.enemies.length];
        const speed = 1.15 + level.difficulty * 0.22;
        enemies.push({
          id: i,
          type: enemyType,
          x: cursorX + 60,
          y: platY - 40,
          w: 40,
          h: 40,
          minX: cursorX + 24,
          maxX: cursorX + platW - 64,
          vx: i % 2 === 0 ? speed : -speed,
          baseY: platY - 40,
          floatPhase: i * 1.3,
          stunnedTimer: 0,
        });
      }

      // Distribución de Bytecoins
      if (coins.length < totalCoinsCount) {
        const isLastCoin = coins.length === totalCoinsCount - 1;
        const val = isLastCoin ? remainingCoinsValue : coinValue;
        remainingCoinsValue = Math.max(0, remainingCoinsValue - val);
        coins.push({
          id: coins.length,
          x: cursorX + Math.floor(platW * 0.25),
          y: platY - 46,
          value: val,
          collected: false,
        });
      }

      cursorX += platW;
    }

    // Si quedaron monedas por colocar, las añadimos en la recta final
    while (coins.length < totalCoinsCount && remainingCoinsValue > 0) {
      const isLast = coins.length === totalCoinsCount - 1;
      const val = isLast ? remainingCoinsValue : Math.min(remainingCoinsValue, coinValue);
      remainingCoinsValue -= val;
      coins.push({
        id: coins.length,
        x: cursorX + 60 + coins.length * 28,
        y: GROUND_Y - 46,
        value: val,
        collected: false,
      });
    }

    // Plataforma final con el Portal de Meta
    cursorX += 70;
    const goalPlatformX = cursorX;
    platforms.push({
      x: goalPlatformX,
      y: GROUND_Y,
      w: 380,
      h: 120,
    });
    const goalX = goalPlatformX + 220;
    const goalY = GROUND_Y;
    const levelLength = goalPlatformX + 380;

    // Posición del NPC secundario puntual (1-2 frases)
    const npcWorldX = level.npc ? Math.min(310, Math.floor(levelLength * level.npc.positionRatio)) : 220;

    // Estado del jugador (The Hacker)
    const player = {
      x: 80,
      y: GROUND_Y - 64,
      w: 42,
      h: 64,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1 as 1 | -1,
      invulnTimer: 0,
      animFrame: 0,
      lives: 5,
      checkpointX: 80,
      checkpointY: GROUND_Y - 64,
      safeGroundX: 80,
      safeGroundY: GROUND_Y - 64,
    };

    let cameraX = 0;
    let elapsedTime = 0;
    let lastTimestamp = performance.now();
    let animFrameId: number;

    const spawnParticles = (x: number, y: number, color: string, count = 12) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const speed = 1.5 + Math.random() * 3.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 1,
          maxLife: 0.45 + Math.random() * 0.35,
          color,
          size: 3 + Math.random() * 3,
        });
      }
    };

    const handlePlayerDamage = (fromPit = false) => {
      if (player.invulnTimer > 0 || connectionLostRef.current || completedRef.current) return;

      player.lives -= 1;
      setLives(player.lives);

      if (player.lives <= 0) {
        // CONNECTION LOST -> Vuelve al último checkpoint con 5 vidas
        connectionLostRef.current = true;
        setConnectionLostBanner(true);
        AudioSystem.connectionLost();
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#00E5FF', 22);

        window.setTimeout(() => {
          player.lives = 5;
          setLives(5);
          player.x = player.checkpointX;
          player.y = player.checkpointY;
          player.vx = 0;
          player.vy = 0;
          player.invulnTimer = 1.5;
          connectionLostRef.current = false;
          setConnectionLostBanner(false);
        }, 1600);
      } else {
        AudioSystem.damage();
        player.invulnTimer = 1.3;
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#00E5FF', 14);
        if (fromPit) {
          player.x = player.safeGroundX;
          player.y = player.safeGroundY - 10;
          player.vx = 0;
          player.vy = 0;
        } else {
          player.vy = -7.5;
          player.vx = -player.facing * 4.5;
        }
      }
    };

    const finishLevel = () => {
      if (completedRef.current) return;
      completedRef.current = true;

      // Recolectar automáticamente las Bytecoins del nivel al cruzar el portal
      const finalBytecoins = level.bytecoins;
      setSessionBytecoins(finalBytecoins);

      const finalMask: [boolean, boolean, boolean] = [
        dataCores[0]?.collected || initialBestDataCores[0] || false,
        dataCores[1]?.collected || initialBestDataCores[1] || false,
        dataCores[2]?.collected || initialBestDataCores[2] || false,
      ];
      const coresCount = dataCores.filter((d) => d.collected).length;

      // Time Bonus relativo (NO existe límite de tiempo, es solo un bonus de fluidez)
      const timeBonus = Math.max(100, Math.round(900 - elapsedTime * 6));
      // Puntuación basada ÚNICAMENTE en Bytecoins + Data Cores + Time Bonus
      const totalScore = finalBytecoins * 10 + coresCount * 500 + timeBonus;

      let stars: 1 | 2 | 3 = 1;
      if (coresCount === 3 || (coresCount >= 2 && timeBonus >= 450)) {
        stars = 3;
      } else if (coresCount >= 1 || timeBonus >= 400) {
        stars = 2;
      }

      if (level.id === 35) {
        AudioSystem.gameEnding();
      } else if (level.levelInWorld === 5) {
        AudioSystem.worldComplete();
      } else {
        AudioSystem.levelComplete();
      }

      onLevelComplete({
        levelId: level.id,
        bytecoinsEarned: finalBytecoins,
        dataCoresCount: coresCount,
        dataCoresMask: finalMask,
        timeSeconds: Math.round(elapsedTime),
        timeBonus,
        totalScore,
        stars,
        isWorldEnd: level.levelInWorld === 5,
        isGameEnd: level.id === 35,
      });
    };

    // Función para dibujar a The Hacker fiel a la imagen adjunta en estilo 2D Cartoon Moderno
    const drawTheHackerSprite = (pX: number, pY: number) => {
      ctx.save();
      ctx.translate(pX + player.w / 2, pY + player.h / 2);
      if (player.facing === -1) {
        ctx.scale(-1, 1);
      }

      // Parpadeo cuando tiene invulnerabilidad tras recibir daño
      if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 12) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      // Si el usuario ha cargado sprites personalizados en ASSETS_CONFIG, usarlos
      const customSpriteUrl =
        !player.onGround
          ? ASSETS_CONFIG.player.jumpSpriteUrl || ASSETS_CONFIG.player.referenceImageUrl
          : Math.abs(player.vx) > 0.4
          ? ASSETS_CONFIG.player.runSpriteUrl || ASSETS_CONFIG.player.referenceImageUrl
          : ASSETS_CONFIG.player.idleSpriteUrl || ASSETS_CONFIG.player.referenceImageUrl;

      const customImg = getLoadedImage(customSpriteUrl);
      if (customImg) {
        ctx.drawImage(customImg, -26, -34, 52, 68);
        ctx.restore();
        return;
      }

      const isMoving = Math.abs(player.vx) > 0.35;
      const stride = isMoving ? Math.sin(elapsedTime * 13) * 7 : 0;
      const bounce = isMoving ? Math.abs(Math.cos(elapsedTime * 13)) * 2.5 : Math.sin(elapsedTime * 3.5) * 1.2;

      ctx.translate(0, -bounce);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Sombra bajo los pies
      ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 32 + bounce, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 1. PIERNAS (Vaqueros/Cargo negros oscuros #1E2433)
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#070B14';
      ctx.fillStyle = '#1E2433';

      // Pierna trasera
      ctx.beginPath();
      ctx.roundRect(-9 - stride * 0.6, 10, 9, 16, 4);
      ctx.fill();
      ctx.stroke();

      // Pierna delantera con bolsillo cargo
      ctx.beginPath();
      ctx.roundRect(1 + stride * 0.6, 10, 9, 16, 4);
      ctx.fill();
      ctx.stroke();

      // 2. ZAPATILLAS DEPORTIVAS AZULES, BLANCAS Y CYAN
      const drawSneaker = (sx: number, sy: number) => {
        ctx.fillStyle = '#1E40AF';
        ctx.beginPath();
        ctx.roundRect(sx, sy, 13, 7, 3);
        ctx.fill();
        ctx.stroke();
        // Lengüeta cyan
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(sx + 3, sy - 2, 5, 3);
        // Suela blanca
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx, sy + 5, 13, 2.5);
      };
      drawSneaker(-10 - stride * 0.7, 24);
      drawSneaker(1 + stride * 0.7, 24);

      // 3. SUDADERA AZUL MARINO (#243B61)
      ctx.fillStyle = '#243B61';
      ctx.beginPath();
      ctx.roundRect(-13, -10, 26, 22, 7);
      ctx.fill();
      ctx.stroke();

      // Bolsillo canguro
      ctx.fillStyle = '#1B2D4B';
      ctx.beginPath();
      ctx.roundRect(-9, 2, 18, 8, 3);
      ctx.fill();

      // Lanyard multicolor + Tarjeta ID en el pecho
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-4, -9);
      ctx.lineTo(0, 0);
      ctx.stroke();

      ctx.strokeStyle = '#00FF66';
      ctx.beginPath();
      ctx.moveTo(4, -9);
      ctx.lineTo(0, 0);
      ctx.stroke();

      // Tarjeta acreditativa blanca con detalle cyan
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#070B14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-4, -1, 8, 10, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-2.5, 1, 5, 3.5);

      // 4. BRAZO CON TABLET VERDE MATRIX Y RELOJ CYAN
      // Brazo delantero con Tablet
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#070B14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(8, -5 - stride * 0.3, 12, 10, 2.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00FF66';
      ctx.fillRect(10, -3 - stride * 0.3, 8, 6);

      // Brazo trasero con reloj digital cyan
      ctx.fillStyle = '#243B61';
      ctx.beginPath();
      ctx.roundRect(-17, -6 + stride * 0.3, 7, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-17, 2 + stride * 0.3, 7, 3);
      ctx.fillStyle = '#FDBA8C';
      ctx.beginPath();
      ctx.arc(-13.5, 7 + stride * 0.3, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 5. CABEZA Y ROSTRO CARTOON EXPRESIVO
      ctx.fillStyle = '#FDBA8C';
      ctx.strokeStyle = '#070B14';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-13, -30, 26, 21, 9);
      ctx.fill();
      ctx.stroke();

      // Pelo castaño bajo la gorra
      ctx.fillStyle = '#5C3317';
      ctx.beginPath();
      ctx.arc(-12, -21, 4.5, 0, Math.PI * 2);
      ctx.arc(0, -28, 5, 0, Math.PI * 2);
      ctx.fill();

      // Gafas de pasta negra rectangulares
      ctx.strokeStyle = '#0A0E17';
      ctx.lineWidth = 2.4;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(-9, -24, 9, 7, 2);
      ctx.roundRect(2, -24, 9, 7, 2);
      ctx.fill();
      ctx.stroke();
      // Puente de las gafas
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.lineTo(2, -21);
      ctx.stroke();

      // Ojos brillantes
      ctx.fillStyle = '#1E1B18';
      ctx.beginPath();
      ctx.arc(-4, -20.5, 1.8, 0, Math.PI * 2);
      ctx.arc(6.5, -20.5, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Sonrisa simpática
      ctx.strokeStyle = '#0A0E17';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(1, -14, 4, 0.15, Math.PI - 0.15);
      ctx.stroke();

      // 6. GORRA MODERNA BLANCA Y NEGRA
      // Copa trasera negra
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = '#070B14';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -28, 13.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Panel frontal blanco
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(2, -28, 9.5, Math.PI * 1.1, -0.1);
      ctx.closePath();
      ctx.fill();

      // Visera curvada negra
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-4, -30, 22, 4.5, 2.2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    };

    // Dibujo de enemigos según su tipo con estética Cartoon Futurista (Azul Eléctrico / Negro / Verde Matrix)
    const drawEnemy = (e: EnemyEntity) => {
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2 + Math.sin(elapsedTime * 5 + e.floatPhase) * 3;

      ctx.save();
      ctx.translate(cx, cy);

      // Sombra energética
      ctx.fillStyle = 'rgba(0, 255, 102, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 15, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cuerpo cartoon tecnológico en negro profundo con borde verde Matrix y núcleo azul eléctrico
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#00FF66';
      ctx.fillStyle = '#091326';

      if (e.type.includes('Bug') || e.type === 'Data Parasites') {
        // Escarabajo / Bug cibernético redondeado con antenas
        ctx.beginPath();
        ctx.arc(0, 2, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Antenas brillantes
        ctx.beginPath();
        ctx.moveTo(-6, -12);
        ctx.lineTo(-11, -20);
        ctx.moveTo(6, -12);
        ctx.lineTo(11, -20);
        ctx.stroke();
      } else if (e.type.includes('Glitch') || e.type === 'Hallucinations' || e.type === 'Data Storms') {
        // Rombo de distorsión digital
        ctx.rotate(Math.sin(elapsedTime * 6 + e.id) * 0.2);
        ctx.beginPath();
        ctx.roundRect(-15, -15, 30, 30, 7);
        ctx.fill();
        ctx.stroke();
      } else {
        // Bot / Archivo / Proceso corrupto con chasis cápsula
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 32, 10);
        ctx.fill();
        ctx.stroke();
      }

      // Visor / Ojos expresivos cartoon en Azul Eléctrico y Verde Matrix
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.roundRect(-10, -6, 20, 9, 4);
      ctx.fill();

      ctx.fillStyle = '#050811';
      const lookDir = e.vx >= 0 ? 2 : -2;
      ctx.beginPath();
      ctx.arc(-4 + lookDir, -1.5, 2.4, 0, Math.PI * 2);
      ctx.arc(4 + lookDir, -1.5, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Etiqueta limpia del tipo de enemigo
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00FF66';
      ctx.fillText(e.type.toUpperCase(), 0, -22);

      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      if (!pausedRef.current && !connectionLostRef.current && !completedRef.current) {
        elapsedTime += dt;
        if (player.invulnTimer > 0) {
          player.invulnTimer = Math.max(0, player.invulnTimer - dt);
        }

        // Movimiento horizontal fluido
        const moveSpeed = 4.6;
        if (inputRef.current.left) {
          player.vx = -moveSpeed;
          player.facing = -1;
        } else if (inputRef.current.right) {
          player.vx = moveSpeed;
          player.facing = 1;
        } else {
          player.vx *= 0.78;
          if (Math.abs(player.vx) < 0.1) player.vx = 0;
        }

        // Salto
        if (inputRef.current.jumpJustPressed && player.onGround) {
          player.vy = -12.4;
          player.onGround = false;
          AudioSystem.jump();
          spawnParticles(player.x + player.w / 2, player.y + player.h, '#00E5FF', 8);
        }
        inputRef.current.jumpJustPressed = false;

        // Gravedad
        player.vy = Math.min(14, player.vy + 0.56);

        // Aplicar velocidad horizontal
        player.x = Math.max(12, player.x + player.vx);

        // Colisión con Bloques de Fase Temporizados (Único obstáculo definido)
        for (const block of phaseBlocks) {
          const cyclePos = ((elapsedTime + block.phaseOffset) % block.cycleDuration) / block.cycleDuration;
          const isOpen = cyclePos < block.openRatio;

          if (!isOpen) {
            // El bloque está ACTIVO (cerrado): hay que esperar al momento adecuado para atravesarlo
            const overlapX = player.x + player.w > block.x && player.x < block.x + block.w;
            const overlapY = player.y + player.h > block.y && player.y < block.y + block.h;
            if (overlapX && overlapY) {
              // Empuja suavemente al jugador fuera del bloque y aplica daño si choca de lleno
              if (player.x + player.w / 2 < block.x + block.w / 2) {
                player.x = block.x - player.w - 2;
              } else {
                player.x = block.x + block.w + 2;
              }
              handlePlayerDamage(false);
            }
          }
        }

        // Aplicar velocidad vertical y colisión con plataformas
        const prevBottom = player.y + player.h;
        player.y += player.vy;
        player.onGround = false;

        for (const plat of platforms) {
          const withinX = player.x + player.w - 6 > plat.x && player.x + 6 < plat.x + plat.w;
          if (withinX && player.vy >= 0 && prevBottom <= plat.y + 14 && player.y + player.h >= plat.y) {
            player.y = plat.y - player.h;
            player.vy = 0;
            player.onGround = true;
            player.safeGroundX = plat.x + 28;
            player.safeGroundY = plat.y - player.h;
          }
        }

        // Caída al vacío
        if (player.y > VIEW_H + 50) {
          handlePlayerDamage(true);
        }

        // Actualizar y comprobar colisión con Enemigos
        for (const enemy of enemies) {
          enemy.x += enemy.vx;
          if (enemy.x <= enemy.minX) {
            enemy.x = enemy.minX;
            enemy.vx = Math.abs(enemy.vx);
          } else if (enemy.x >= enemy.maxX) {
            enemy.x = enemy.maxX;
            enemy.vx = -Math.abs(enemy.vx);
          }

          const overlapX = player.x + player.w - 6 > enemy.x && player.x + 6 < enemy.x + enemy.w;
          const overlapY = player.y + player.h > enemy.y && player.y < enemy.y + enemy.h;

          if (overlapX && overlapY) {
            // Si cae encima del enemigo rebota sobre él sin otorgar puntos (según sección 17)
            if (player.vy > 1.5 && player.y + player.h - player.vy <= enemy.y + 16) {
              player.vy = -10.2;
              AudioSystem.enemy();
              spawnParticles(enemy.x + enemy.w / 2, enemy.y, '#00FF66', 10);
            } else {
              handlePlayerDamage(false);
            }
          }
        }

        // Recoger Bytecoins
        for (const coin of coins) {
          if (!coin.collected) {
            const dx = player.x + player.w / 2 - coin.x;
            const dy = player.y + player.h / 2 - coin.y;
            if (Math.hypot(dx, dy) < 34) {
              coin.collected = true;
              AudioSystem.bytecoin();
              setSessionBytecoins((prev) => Math.min(level.bytecoins, prev + coin.value));
              spawnParticles(coin.x, coin.y, '#00E5FF', 10);
            }
          }
        }

        // Recoger los 3 Data Cores opcionales
        for (const dc of dataCores) {
          if (!dc.collected) {
            const dx = player.x + player.w / 2 - dc.x;
            const dy = player.y + player.h / 2 - dc.y;
            if (Math.hypot(dx, dy) < 38) {
              dc.collected = true;
              AudioSystem.dataCore();
              setDataCoresMask((prev) => {
                const next: [boolean, boolean, boolean] = [...prev] as [boolean, boolean, boolean];
                next[dc.index] = true;
                return next;
              });
              spawnParticles(dc.x, dc.y, '#00FF66', 16);
            }
          }
        }

        // Activar Checkpoints
        for (const cp of checkpoints) {
          if (!cp.activated && Math.abs(player.x - cp.x) < 42) {
            cp.activated = true;
            player.checkpointX = cp.x;
            player.checkpointY = cp.y - player.h;
            AudioSystem.checkpoint();
            setCheckpointBanner('CHECKPOINT ACTIVADO');
            window.setTimeout(() => setCheckpointBanner(null), 1800);
            spawnParticles(cp.x, cp.y - 40, '#00FF66', 18);
          }
        }

        // Activar Nodos de Misión
        for (const node of missionNodes) {
          if (!node.activated && Math.abs(player.x - node.x) < 46) {
            node.activated = true;
            AudioSystem.unlock();
            spawnParticles(node.x, node.y - 36, '#00E5FF', 14);
          }
        }

        // Llegar al Portal Final del Nivel
        if (Math.abs(player.x + player.w / 2 - goalX) < 44 && Math.abs(player.y + player.h - goalY) < 90) {
          finishLevel();
        }

        // Cámara suave centrada en The Hacker
        const targetCamX = Math.max(0, Math.min(levelLength - VIEW_W, player.x - VIEW_W * 0.32));
        cameraX += (targetCamX - cameraX) * 0.14;
      }

      // Actualizar partículas
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // =====================================================================
      // RENDERIZADO 2D MODERNO MULTICAPA (PALETA GLOBAL: AZUL ELÉCTRICO, NEGRO, VERDE MATRIX)
      // =====================================================================
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      // CAPA 0: Cielo Nocturno Tecnológico Profundo (#050811 -> #0A152C)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      skyGrad.addColorStop(0, '#050811');
      skyGrad.addColorStop(0.6, '#081226');
      skyGrad.addColorStop(1, '#040914');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // CAPA 1 (Parallax Lejano): Columnas de Datos Matrix y Nodos Eléctricos
      ctx.save();
      const farOffset = -(cameraX * 0.18) % 80;
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.07 * worldConfig.accentIntensity})`;
      ctx.lineWidth = 1;
      for (let x = farOffset; x < VIEW_W; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, VIEW_H);
        ctx.stroke();

        // Pequeños pulsos Matrix descendiendo
        const pulseY = ((elapsedTime * 60 + x * 3) % VIEW_H);
        ctx.fillStyle = 'rgba(0, 255, 102, 0.35)';
        ctx.fillRect(x - 1.5, pulseY, 3, 18);
      }
      ctx.restore();

      // CAPA 2 (Parallax Medio): Torres / Siluetas Futuristas del Mundo Digital
      ctx.save();
      const midOffset = -(cameraX * 0.4) % 160;
      for (let x = midOffset - 160; x < VIEW_W + 160; x += 160) {
        const towerH = 180 + ((Math.abs(Math.floor(x)) * 13) % 120);
        ctx.fillStyle = 'rgba(9, 18, 38, 0.85)';
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x + 20, VIEW_H - towerH - 80, 110, towerH + 80, 12);
        ctx.fill();
        ctx.stroke();

        // Ventanas / Circuitos Matrix Green en las torres
        ctx.fillStyle = 'rgba(0, 255, 102, 0.25)';
        ctx.fillRect(x + 40, VIEW_H - towerH - 50, 70, 6);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.fillRect(x + 40, VIEW_H - towerH - 25, 45, 6);
      }
      ctx.restore();

      // TRANSFORMACIÓN DE CÁMARA DEL MUNDO
      ctx.save();
      ctx.translate(-cameraX, 0);

      // DIBUJAR PLATAFORMAS (Diseño Cartoon Futurista Limpio)
      for (const plat of platforms) {
        if (plat.x + plat.w < cameraX - 40 || plat.x > cameraX + VIEW_W + 40) continue;

        const platGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + 60);
        platGrad.addColorStop(0, '#0E1E38');
        platGrad.addColorStop(1, '#050811');
        ctx.fillStyle = platGrad;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 12);
        ctx.fill();
        ctx.stroke();

        // Franja luminosa superior Verde Matrix / Azul Eléctrico
        ctx.fillStyle = '#00FF66';
        ctx.beginPath();
        ctx.roundRect(plat.x + 6, plat.y + 4, plat.w - 12, 5, 3);
        ctx.fill();
      }

      // DIBUJAR NPC SECUNDARIO PUNTUAL (1-2 frases)
      if (level.npc) {
        const npcY = GROUND_Y;
        ctx.save();
        ctx.translate(npcWorldX, npcY);

        // Pequeño bot asistente flotante
        const floatY = -36 + Math.sin(elapsedTime * 4) * 4;
        ctx.fillStyle = '#0A1931';
        ctx.strokeStyle = '#00FF66';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-16, floatY - 16, 32, 28, 9);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00E5FF';
        ctx.beginPath();
        ctx.arc(-5, floatY - 2, 3, 0, Math.PI * 2);
        ctx.arc(5, floatY - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Bocadillo de diálogo corto cuando el jugador está cerca (mayor rango de visibilidad)
        if (Math.abs(player.x - npcWorldX) < 380) {
          ctx.font = '700 10px "Outfit", sans-serif';
          const text = level.npc.dialogue;
          const bubbleW = Math.min(240, Math.max(150, text.length * 5.3));
          ctx.fillStyle = 'rgba(5, 8, 17, 0.94)';
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-bubbleW / 2, floatY - 72, bubbleW, 44, 10);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#00FF66';
          ctx.textAlign = 'center';
          ctx.fillText(level.npc.name, 0, floatY - 56);

          ctx.fillStyle = '#F8FAFC';
          ctx.font = '600 10px "Outfit", sans-serif';
          ctx.fillText(text.slice(0, 42), 0, floatY - 41);
          if (text.length > 42) {
            ctx.fillText(text.slice(42, 84), 0, floatY - 30);
          }
        }
        ctx.restore();
      }

      // DIBUJAR NODOS DE MISIÓN
      for (const node of missionNodes) {
        ctx.save();
        ctx.translate(node.x, node.y);
        const color = node.activated ? '#00FF66' : '#00E5FF';
        ctx.strokeStyle = color;
        ctx.fillStyle = '#071124';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-18, -52, 36, 52, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, -28, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.activated ? 'ONLINE' : node.label, 0, -60);
        ctx.restore();
      }

      // DIBUJAR CHECKPOINTS
      for (const cp of checkpoints) {
        ctx.save();
        ctx.translate(cp.x, cp.y);
        const activeColor = cp.activated ? '#00FF66' : '#00E5FF';
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -64);
        ctx.stroke();

        // Bandera / Rombo holográfico
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.moveTo(0, -64);
        ctx.lineTo(28, -52);
        ctx.lineTo(0, -40);
        ctx.closePath();
        ctx.fill();

        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(cp.activated ? 'CHECKPOINT ✓' : 'CHECKPOINT', 0, -72);
        ctx.restore();
      }

      // DIBUJAR OBSTÁCULOS: BLOQUES DE ESPERA SINCRONIZADA
      for (const block of phaseBlocks) {
        const cyclePos = ((elapsedTime + block.phaseOffset) % block.cycleDuration) / block.cycleDuration;
        const isOpen = cyclePos < block.openRatio;

        ctx.save();
        ctx.translate(block.x, block.y);

        // Emisor superior e inferior
        ctx.fillStyle = '#0B172E';
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-4, -12, block.w + 8, 12, 4);
        ctx.roundRect(-4, block.h - 10, block.w + 8, 12, 4);
        ctx.fill();
        ctx.stroke();

        if (isOpen) {
          // FASE ABIERTA: Verde Matrix translúcido ("PASO LIBRE")
          ctx.strokeStyle = 'rgba(0, 255, 102, 0.55)';
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2;
          ctx.strokeRect(4, 0, block.w - 8, block.h - 10);
          ctx.setLineDash([]);

          ctx.fillStyle = '#00FF66';
          ctx.font = '800 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('GO ►', block.w / 2, -18);
        } else {
          // FASE BLOQUEADA: Campo de energía sólido que requiere esperar
          const grad = ctx.createLinearGradient(0, 0, block.w, 0);
          grad.addColorStop(0, 'rgba(0, 229, 255, 0.85)');
          grad.addColorStop(0.5, 'rgba(0, 255, 102, 0.92)');
          grad.addColorStop(1, 'rgba(0, 229, 255, 0.85)');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(2, 0, block.w - 4, block.h - 10, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#00E5FF';
          ctx.font = '800 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(block.isFirewallTheme ? 'FIREWALL' : 'WAIT ⏳', block.w / 2, -18);
        }

        ctx.restore();
      }

      // DIBUJAR BYTECOINS (🪙)
      for (const coin of coins) {
        if (coin.collected) continue;
        const bob = Math.sin(elapsedTime * 5 + coin.id) * 4;
        ctx.save();
        ctx.translate(coin.x, coin.y + bob);

        ctx.fillStyle = '#00E5FF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#050811';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', 0, 1);
        ctx.restore();
      }

      // DIBUJAR LOS 3 DATA CORES (💾)
      for (const dc of dataCores) {
        if (dc.collected) continue;
        const bob = Math.sin(elapsedTime * 4 + dc.index * 2) * 5;
        ctx.save();
        ctx.translate(dc.x, dc.y + bob);

        // Halo verde Matrix
        ctx.fillStyle = 'rgba(0, 255, 102, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();

        // Cubo / Núcleo de Datos
        ctx.fillStyle = '#00FF66';
        ctx.strokeStyle = '#050811';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-13, -13, 26, 26, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#050811';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CORE', 0, 0);
        ctx.restore();
      }

      // DIBUJAR ENEMIGOS
      for (const enemy of enemies) {
        drawEnemy(enemy);
      }

      // DIBUJAR PORTAL DE META FINAL DEL NIVEL
      ctx.save();
      ctx.translate(goalX, goalY - 56);
      const portalPulse = 1 + Math.sin(elapsedTime * 5) * 0.06;
      ctx.scale(portalPulse, portalPulse);

      ctx.strokeStyle = '#00FF66';
      ctx.lineWidth = 4;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00FF66';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(level.id === 35 ? 'AI CORE' : 'PORTAL', 0, 4);
      ctx.restore();

      // DIBUJAR A THE HACKER
      drawTheHackerSprite(player.x, player.y);

      // DIBUJAR PARTÍCULAS DE ENERGÍA
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameId);
  }, [level, initialBestDataCores, onLevelComplete, worldConfig.accentIntensity]);

  // Handlers para los botones táctiles grandes (◀ ▶ y ⬆)
  const handleTouchDir = (dir: 'left' | 'right', pressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    inputRef.current[dir] = pressed;
    setActiveTouch((prev) => ({ ...prev, [dir]: pressed }));
  };

  const handleTouchJump = (pressed: boolean) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (pressed && !inputRef.current.jump) {
      inputRef.current.jumpJustPressed = true;
    }
    inputRef.current.jump = pressed;
    setActiveTouch((prev) => ({ ...prev, jump: pressed }));
  };

  const coresCollectedCount = dataCoresMask.filter(Boolean).length;

  return (
    <div className="relative w-full h-full flex flex-col justify-between bg-[#050811] overflow-hidden select-none">
      {/* 20. HUD DURANTE EL JUEGO: Sencillo y limpio */}
      <header className="w-full px-3 pt-2.5 pb-2 bg-[#070E1E]/95 border-b border-[#00E5FF]/30 flex items-center justify-between gap-2 z-20 shrink-0">
        {/* Zona superior izquierda: ❤️ ❤️ ❤️ ❤️ ❤️ */}
        <div className="flex items-center gap-1 bg-[#050811] px-3 py-1.5 rounded-2xl border border-[#00E5FF]/40">
          {Array.from({ length: 5 }).map((_, idx) => (
            <span
              key={idx}
              className={`text-base sm:text-lg transition-transform duration-200 ${
                idx < lives ? 'scale-100 opacity-100' : 'scale-75 opacity-25 grayscale'
              }`}
            >
              ❤️
            </span>
          ))}
        </div>

        {/* Botón voluntario de Casa/Mapa + Pausa */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onExitToMap}
            title="Volver al Mapa General"
            className="p-2 rounded-xl bg-[#0A162E] border border-[#00E5FF]/50 text-[#00E5FF] active:scale-95 transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={togglePause}
            title="Pausa"
            className="p-2 rounded-xl bg-[#0A162E] border border-[#00E5FF]/50 text-[#00E5FF] active:scale-95 transition cursor-pointer"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>

        {/* Zona superior derecha: 🪙 BYTECOINS + 💾 0/3 */}
        <div className="flex items-center gap-2 bg-[#050811] px-3 py-1.5 rounded-2xl border border-[#00FF66]/40 font-mono-tech text-xs sm:text-sm font-extrabold">
          <span className="text-[#00E5FF]">🪙 {initialTotalBytecoins + sessionBytecoins}</span>
          <span className="text-slate-600">|</span>
          <span className="text-[#00FF66]">💾 {coresCollectedCount}/3</span>
        </div>
      </header>

      {/* Sub-barra con el Mundo, Nombre del Nivel y botón para ver/ocultar la Misión */}
      <div className="w-full bg-[#091326] px-4 py-1.5 flex items-center justify-between text-[11px] font-mono-tech border-b border-[#00E5FF]/15 shrink-0">
        <span className="text-[#00E5FF] font-bold truncate">
          WORLD {level.worldId} · LEVEL {level.id}: {level.name}
        </span>
        <button
          onClick={() => setShowObjectiveToast((prev) => !prev)}
          className="px-2.5 py-0.5 rounded-full bg-[#00FF66]/15 border border-[#00FF66]/60 text-[#00FF66] font-bold shrink-0 ml-2 cursor-pointer active:scale-95 transition"
        >
          {showObjectiveToast ? 'OCULTAR MISIÓN' : '📋 VER MISIÓN'}
        </button>
      </div>

      {/* ÁREA CENTRAL DEL CANVAS 2D */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden bg-[#050811]">
        <canvas
          ref={canvasRef}
          width={480}
          height={640}
          className="w-full h-full object-contain max-h-full"
        />

        {/* Banner de la tarea / Objetivo del nivel */}
        {showObjectiveToast && (
          <div
            onClick={() => setShowObjectiveToast(false)}
            className="absolute top-3 inset-x-4 max-w-md mx-auto rounded-2xl bg-[#071022]/95 border-2 border-[#00E5FF] p-3.5 shadow-2xl z-30 cursor-pointer electric-glow"
          >
            <div className="flex items-center justify-between text-[10px] font-mono-tech text-[#00FF66] mb-1.5">
              <span>MISIÓN · NIVEL {level.id} ({level.progressionRole})</span>
              <span className="text-[#00E5FF]">{level.difficultyLabel} · [✕ CERRAR]</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-medium">{level.objective}</p>
          </div>
        )}

        {/* Feedback de Checkpoint */}
        {checkpointBanner && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 rounded-full bg-[#050811]/95 border-2 border-[#00FF66] px-5 py-1.5 text-xs font-extrabold text-[#00FF66] tracking-wider shadow-lg z-30">
            ✓ {checkpointBanner}
          </div>
        )}

        {/* 13. CONNECTION LOST: Vuelve al último checkpoint */}
        {connectionLostBanner && (
          <div className="absolute inset-0 bg-[#050811]/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-40">
            <div className="rounded-3xl bg-[#0A1428] border-2 border-[#00E5FF] p-6 max-w-xs w-full electric-glow">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-arcade text-2xl font-extrabold text-[#00E5FF] tracking-wide mb-2">
                CONNECTION LOST
              </h3>
              <p className="text-xs text-slate-300">
                Restaurando conexión desde el último Checkpoint alcanzado...
              </p>
            </div>
          </div>
        )}

        {/* Modal de Pausa */}
        {isPaused && (
          <div className="absolute inset-0 bg-[#050811]/85 backdrop-blur-xs flex items-center justify-center p-5 z-40">
            <div className="w-full max-w-xs rounded-3xl bg-[#0A1326] border-2 border-[#00E5FF] p-6 text-center space-y-3 electric-glow">
              <h3 className="font-arcade text-2xl font-extrabold text-[#00E5FF]">PAUSA</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{level.objective}</p>
              <button
                onClick={togglePause}
                className="w-full py-3 rounded-2xl bg-[#00FF66] text-[#050811] font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> CONTINUAR
              </button>
              <button
                onClick={onExitToMap}
                className="w-full py-3 rounded-2xl bg-[#0E1E38] border border-[#00E5FF] text-[#00E5FF] font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" /> MAPA GENERAL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 20 y 21. CONTROLES TÁCTILES GRANDES (Parte inferior izquierda: ◀ ▶ | Parte inferior derecha: ⬆) */}
      <footer className="w-full bg-[#070E1E] border-t border-[#00E5FF]/30 px-4 py-3 flex items-center justify-between shrink-0 z-20">
        {/* Parte inferior izquierda: ◀ ▶ */}
        <div className="flex items-center gap-3">
          <button
            onTouchStart={handleTouchDir('left', true)}
            onTouchEnd={handleTouchDir('left', false)}
            onTouchCancel={handleTouchDir('left', false)}
            onMouseDown={handleTouchDir('left', true)}
            onMouseUp={handleTouchDir('left', false)}
            onMouseLeave={handleTouchDir('left', false)}
            aria-label="Mover Izquierda"
            className={`w-20 h-16 sm:w-24 sm:h-18 rounded-2xl font-arcade text-2xl font-black flex items-center justify-center transition-all cursor-pointer ${
              activeTouch.left
                ? 'bg-[#00E5FF] text-[#050811] scale-95 shadow-[0_0_20px_#00E5FF]'
                : 'bg-[#0C1A36] text-[#00E5FF] border-2 border-[#00E5FF]'
            }`}
          >
            ◀
          </button>

          <button
            onTouchStart={handleTouchDir('right', true)}
            onTouchEnd={handleTouchDir('right', false)}
            onTouchCancel={handleTouchDir('right', false)}
            onMouseDown={handleTouchDir('right', true)}
            onMouseUp={handleTouchDir('right', false)}
            onMouseLeave={handleTouchDir('right', false)}
            aria-label="Mover Derecha"
            className={`w-20 h-16 sm:w-24 sm:h-18 rounded-2xl font-arcade text-2xl font-black flex items-center justify-center transition-all cursor-pointer ${
              activeTouch.right
                ? 'bg-[#00E5FF] text-[#050811] scale-95 shadow-[0_0_20px_#00E5FF]'
                : 'bg-[#0C1A36] text-[#00E5FF] border-2 border-[#00E5FF]'
            }`}
          >
            ▶
          </button>
        </div>

        {/* Parte inferior derecha: ⬆ (Sin botón de habilidad especial) */}
        <div>
          <button
            onTouchStart={handleTouchJump(true)}
            onTouchEnd={handleTouchJump(false)}
            onTouchCancel={handleTouchJump(false)}
            onMouseDown={handleTouchJump(true)}
            onMouseUp={handleTouchJump(false)}
            onMouseLeave={handleTouchJump(false)}
            aria-label="Saltar"
            className={`w-24 h-16 sm:w-28 sm:h-18 rounded-2xl font-arcade text-2xl font-black flex items-center justify-center transition-all cursor-pointer ${
              activeTouch.jump
                ? 'bg-[#00FF66] text-[#050811] scale-95 shadow-[0_0_24px_#00FF66]'
                : 'bg-[#0B221E] text-[#00FF66] border-2 border-[#00FF66]'
            }`}
          >
            ⬆
          </button>
        </div>
      </footer>
    </div>
  );
};
