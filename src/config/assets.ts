/**
 * ARQUITECTURA MODULAR DE ASSETS
 * Permite sustituir fácilmente cualquier placeholder por archivos gráficos o de audio definitivos
 * proporcionados posteriormente por el usuario sin modificar la lógica del motor.
 */

export interface GameAssetsConfig {
  player: {
    referenceImageUrl: string | null;
    idleSpriteUrl: string | null;
    runSpriteUrl: string | null;
    jumpSpriteUrl: string | null;
    hurtSpriteUrl: string | null;
  };
  backgrounds: {
    farLayerUrl: string | null;
    midLayerUrl: string | null;
    nearLayerUrl: string | null;
  };
  collectibles: {
    bytecoinUrl: string | null;
    dataCoreUrl: string | null;
    checkpointUrl: string | null;
  };
  obstacles: {
    phaseBlockUrl: string | null;
    firewallGateUrl: string | null;
  };
  enemies: Record<string, string | null>;
  audio: Record<string, string | null>;
}

export const ASSETS_CONFIG: GameAssetsConfig = {
  player: {
    referenceImageUrl: null, // Usa el renderizador cartoon fiel a The Hacker (gorra blanca/negra, gafas, sudadera azul con lanyard, tablet verde, vaqueros oscuros, zapatillas azules/blancas) o imagen adjunta
    idleSpriteUrl: null,
    runSpriteUrl: null,
    jumpSpriteUrl: null,
    hurtSpriteUrl: null,
  },
  backgrounds: {
    farLayerUrl: null,
    midLayerUrl: null,
    nearLayerUrl: null,
  },
  collectibles: {
    bytecoinUrl: null,
    dataCoreUrl: null,
    checkpointUrl: null,
  },
  obstacles: {
    phaseBlockUrl: null,
    firewallGateUrl: null,
  },
  enemies: {},
  audio: {},
};

// Cache de imágenes cargadas en memoria si se configuran URLs externas
const loadedImages: Record<string, HTMLImageElement> = {};

export function getLoadedImage(url: string | null): HTMLImageElement | null {
  if (!url) return null;
  if (loadedImages[url]) {
    return loadedImages[url].complete ? loadedImages[url] : null;
  }
  const img = new Image();
  img.src = url;
  loadedImages[url] = img;
  return null;
}
