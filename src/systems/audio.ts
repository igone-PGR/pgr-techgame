import { ASSETS_CONFIG } from '../config/assets';

class SoundManager {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;
  public musicEnabled: boolean = true;
  private musicInterval: number | null = null;
  private musicStep: number = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playCustomOrSynth(key: string, synthFallback: () => void) {
    if (!this.soundEnabled) return;
    const customUrl = ASSETS_CONFIG.audio[key];
    if (customUrl) {
      const audio = new Audio(customUrl);
      audio.volume = 0.5;
      audio.play().catch(() => synthFallback());
      return;
    }
    synthFallback();
  }

  private tone(
    freq: number,
    type: OscillatorType = 'sine',
    duration = 0.12,
    vol = 0.08,
    slideTo?: number,
    delayMs = 0
  ) {
    const run = () => {
      if (!this.soundEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (slideTo) {
          osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch {}
    };

    if (delayMs > 0) {
      window.setTimeout(run, delayMs);
    } else {
      run();
    }
  }

  // 1. Salto
  jump() {
    this.playCustomOrSynth('jump', () => {
      this.tone(260, 'sine', 0.14, 0.09, 540);
    });
  }

  // 2. Recibir daño
  damage() {
    this.playCustomOrSynth('damage', () => {
      this.tone(180, 'sawtooth', 0.22, 0.11, 75);
    });
  }

  // 3. Recoger Bytecoin
  bytecoin() {
    this.playCustomOrSynth('bytecoin', () => {
      this.tone(880, 'sine', 0.07, 0.07);
      this.tone(1174, 'sine', 0.1, 0.07, undefined, 50);
    });
  }

  // 4. Recoger Data Core
  dataCore() {
    this.playCustomOrSynth('dataCore', () => {
      this.tone(587, 'triangle', 0.1, 0.1);
      this.tone(880, 'triangle', 0.12, 0.1, undefined, 70);
      this.tone(1174, 'triangle', 0.2, 0.12, undefined, 140);
    });
  }

  // 5. Checkpoint
  checkpoint() {
    this.playCustomOrSynth('checkpoint', () => {
      this.tone(523, 'sine', 0.1, 0.09);
      this.tone(659, 'sine', 0.1, 0.09, undefined, 80);
      this.tone(784, 'sine', 0.18, 0.1, undefined, 160);
    });
  }

  // 6. Enemigo (rebote / interacción)
  enemy() {
    this.playCustomOrSynth('enemy', () => {
      this.tone(320, 'triangle', 0.12, 0.08, 160);
    });
  }

  // 7. Desbloqueo
  unlock() {
    this.playCustomOrSynth('unlock', () => {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'triangle', 0.14, 0.09, undefined, i * 70));
    });
  }

  // 8. Completar nivel
  levelComplete() {
    this.playCustomOrSynth('levelComplete', () => {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 'sine', 0.16, 0.1, undefined, i * 80));
    });
  }

  // 9. Completar mundo
  worldComplete() {
    this.playCustomOrSynth('worldComplete', () => {
      [440, 554, 659, 880, 1108].forEach((f, i) => this.tone(f, 'triangle', 0.18, 0.11, undefined, i * 85));
    });
  }

  // 10. Transición entre mundos
  worldTransition() {
    this.playCustomOrSynth('worldTransition', () => {
      this.tone(300, 'sine', 0.35, 0.09, 900);
    });
  }

  // 11. CONNECTION LOST
  connectionLost() {
    this.playCustomOrSynth('connectionLost', () => {
      [340, 280, 220, 150].forEach((f, i) => this.tone(f, 'sawtooth', 0.18, 0.1, undefined, i * 100));
    });
  }

  // 12. SYSTEM RESTORED
  systemRestored() {
    this.playCustomOrSynth('systemRestored', () => {
      [523, 659, 784, 987, 1046].forEach((f, i) => this.tone(f, 'triangle', 0.2, 0.11, undefined, i * 90));
    });
  }

  // 13. Final del juego
  gameEnding() {
    this.playCustomOrSynth('gameEnding', () => {
      [523, 659, 784, 1046, 1318, 1567].forEach((f, i) =>
        this.tone(f, 'triangle', 0.24, 0.11, undefined, i * 110)
      );
    });
  }

  // Música ambiental arcade suave y discreta
  startMusic() {
    if (!this.musicEnabled) {
      this.stopMusic();
      return;
    }
    if (this.musicInterval !== null) return;
    const notes = [220, 261.63, 329.63, 392, 329.63, 261.63, 246.94, 293.66];
    this.musicInterval = window.setInterval(() => {
      if (!this.musicEnabled || document.hidden) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const freq = notes[this.musicStep % notes.length];
      this.musicStep++;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.018, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch {}
    }, 450);
  }

  stopMusic() {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const AudioSystem = new SoundManager();
