export type EnemyType =
  | 'Bugs'
  | 'Glitches'
  | 'Corrupted Files'
  | 'Spam Bots'
  | 'Trolls'
  | 'Data Parasites'
  | 'Data Storms'
  | 'Cloud Bugs'
  | 'Lost Files'
  | 'Security Bots'
  | 'Malware'
  | 'Neural Bugs'
  | 'Rogue Processes'
  | 'Hallucinations'
  | 'Cooling Bots'
  | 'Power Surges'
  | 'Overload';

export type ProgressionRole =
  | 'APRENDER'
  | 'PRACTICAR'
  | 'COMBINAR'
  | 'DIFICULTAD'
  | 'PRUEBA FINAL DEL MUNDO';

export interface NPCData {
  name: string;
  dialogue: string;
  positionRatio: number; // 0.1 to 0.85 along level length
}

export interface LevelConfig {
  id: number; // 1 to 35
  worldId: number; // 1 to 7
  levelInWorld: number; // 1 to 5
  name: string;
  progressionRole: ProgressionRole;
  objective: string;
  obstacleDescription: string;
  enemies: EnemyType[];
  bytecoins: number;
  dataCores: 3;
  difficulty: 1 | 2 | 3 | 4 | 5;
  difficultyLabel: string;
  requiredBytecoinsToUnlock: number;
  npc?: NPCData;
  worldCompleteBanner?: {
    restoredText: string;
    unlockedText: string;
  };
}

export interface WorldConfig {
  id: number; // 1 to 7
  name: string;
  subtitle: string;
  concepts: string[];
  enemies: EnemyType[];
  storyHint: string;
  restoredMessage: string;
  unlockedNextMessage: string;
  accentIntensity: number; // Subtle lighting variation within the global Blue/Black/Matrix Green palette
}

export interface LevelProgress {
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  dataCoresCollected: [boolean, boolean, boolean];
  bytecoinsEarned: number;
}

export interface SaveData {
  unlockedWorld: number; // 1 to 7
  unlockedLevel: number; // 1 to 35
  totalBytecoins: number; // Cumulative, never spent!
  levels: Record<number, LevelProgress>;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export type ScreenState =
  | 'HOME'
  | 'MAP'
  | 'GAME'
  | 'LEVEL_COMPLETE'
  | 'WORLD_TRANSITION'
  | 'GAME_ENDING';

export interface LevelCompletionSummary {
  levelId: number;
  bytecoinsEarned: number;
  dataCoresCount: number;
  dataCoresMask: [boolean, boolean, boolean];
  timeSeconds: number;
  timeBonus: number;
  totalScore: number;
  stars: 1 | 2 | 3;
  isWorldEnd: boolean;
  isGameEnd: boolean;
}
