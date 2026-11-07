// ===== 轻量音效：WebAudio 合成，无音频文件 =====
import { STORAGE_KEYS } from '../config.js';

class SoundFX {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.shotCounter = 0;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(STORAGE_KEYS.mute) === '1';
    } catch {
      /* ignore */
    }
  }

  /** 必须在用户手势中调用一次，解锁 AudioContext */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE_KEYS.mute, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  play(name) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    switch (name) {
      case 'shoot':
        this.shotCounter++;
        if (this.shotCounter % 2 === 0) {
          this.tone(880, 520, 0.055, 'square', 0.016);
        }
        break;
      case 'enemyShoot':
        this.tone(300, 170, 0.08, 'sawtooth', 0.012);
        break;
      case 'hit':
        this.tone(220, 140, 0.045, 'square', 0.02);
        break;
      case 'explode':
        this.noise(0.32, 0.055, 1400);
        this.tone(150, 45, 0.3, 'sine', 0.05);
        break;
      case 'bigExplode':
        this.noise(0.7, 0.09, 900);
        this.tone(110, 32, 0.65, 'sine', 0.075);
        break;
      case 'powerup':
        this.tone(520, 660, 0.08, 'sine', 0.04, 0);
        this.tone(780, 990, 0.1, 'sine', 0.035, 0.07);
        this.tone(1040, 1300, 0.12, 'sine', 0.03, 0.14);
        break;
      case 'bomb':
        this.noise(0.9, 0.1, 700);
        this.tone(90, 28, 0.8, 'sine', 0.08);
        break;
      case 'warning':
        this.tone(180, 150, 0.24, 'sawtooth', 0.035, 0);
        this.tone(180, 150, 0.24, 'sawtooth', 0.035, 0.3);
        break;
      case 'hurt':
        this.tone(210, 70, 0.35, 'sawtooth', 0.06);
        this.noise(0.25, 0.05, 600);
        break;
      case 'ui':
        this.tone(560, 780, 0.06, 'square', 0.022);
        break;
      case 'start':
        this.tone(440, 620, 0.09, 'square', 0.03, 0);
        this.tone(620, 880, 0.12, 'square', 0.03, 0.09);
        break;
      default:
        break;
    }
  }

  tone(freq, endFreq, duration, type = 'square', volume = 0.03, delay = 0) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  noise(duration, volume, filterFreq) {
    const ctx = this.ctx;
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 1);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, filterFreq * 0.25), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }
}

export const sfx = new SoundFX();
