import { SaveData, LevelProgress } from '../types/game';
import { LEVELS_DATA } from '../data/levels';

const STORAGE_KEY = 'the_hacker_digital_world_save_v1';

export function createInitialSaveData(): SaveData {
  return {
    unlockedWorld: 1,
    unlockedLevel: 1,
    totalBytecoins: 0,
    levels: {},
    soundEnabled: true,
    musicEnabled: true,
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialSaveData();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...createInitialSaveData(),
      ...parsed,
      levels: parsed.levels || {},
    };
  } catch {
    return createInitialSaveData();
  }
}

export function saveProgressData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function resetAllProgress(): SaveData {
  const fresh = createInitialSaveData();
  saveProgressData(fresh);
  return fresh;
}

export function getLevelProgress(save: SaveData, levelId: number): LevelProgress {
  return (
    save.levels[levelId] || {
      completed: false,
      stars: 0,
      bestScore: 0,
      dataCoresCollected: [false, false, false],
      bytecoinsEarned: 0,
    }
  );
}

export function getWorldStats(save: SaveData, worldId: number) {
  const worldLevels = LEVELS_DATA.filter((l) => l.worldId === worldId);
  let completedCount = 0;
  let starsEarned = 0;
  let dataCoresEarned = 0;

  worldLevels.forEach((lvl) => {
    const p = getLevelProgress(save, lvl.id);
    if (p.completed) completedCount++;
    starsEarned += p.stars;
    dataCoresEarned += p.dataCoresCollected.filter(Boolean).length;
  });

  return {
    completedCount,
    totalLevels: worldLevels.length, // 5
    starsEarned,
    maxStars: worldLevels.length * 3, // 15
    dataCoresEarned,
    maxDataCores: worldLevels.length * 3, // 15
  };
}

export function getGlobalStats(save: SaveData) {
  let totalStars = 0;
  let totalDataCores = 0;
  let totalScore = 0;
  let completedLevels = 0;

  LEVELS_DATA.forEach((lvl) => {
    const p = getLevelProgress(save, lvl.id);
    if (p.completed) completedLevels++;
    totalStars += p.stars;
    totalDataCores += p.dataCoresCollected.filter(Boolean).length;
    totalScore += p.bestScore;
  });

  return {
    totalStars,
    maxStars: LEVELS_DATA.length * 3, // 105
    totalDataCores,
    maxDataCores: LEVELS_DATA.length * 3, // 105
    totalScore,
    completedLevels,
    totalLevels: LEVELS_DATA.length, // 35
  };
}
