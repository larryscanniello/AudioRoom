import {
  MAX_EFFECT_PARAMS,
  SAB_STRIDE_TRACK,
} from "../Constants/constants.js";
import type { EffectType, EffectSlotConfig } from "../Types/AudioState.js";
export type { EffectType, EffectSlotConfig };

const MAX_DELAY_SAMPLES = 48000; // 1 second at 48kHz

export const BIQUAD_PARAM = { CUTOFF_HZ: 0, RESONANCE: 1, WET: 2 } as const;
export const DELAY_PARAM  = { TIME_SAMPLES: 0, FEEDBACK: 1, WET: 2 } as const;
export const DIST_PARAM   = { DRIVE: 0, WET: 1 } as const;

export interface Effect {
  processBlock(block: Float32Array, len: number, sampleRate: number): void;
}

class BiquadEffect implements Effect {
  private sab: Float32Array;
  private base: number;
  private kind: 'lowpass' | 'highpass';
  // Direct Form I IIR delay line
  private x1 = 0; private x2 = 0;
  private y1 = 0; private y2 = 0;
  // Cached coefficients — recomputed only when cutoff or Q changes
  private b0 = 1; private b1 = 0; private b2 = 0;
  private a1 = 0; private a2 = 0;
  private lastCutoff = -1; private lastQ = -1;

  constructor(sab: Float32Array, track: number, slot: number, kind: 'lowpass' | 'highpass') {
    this.sab  = sab;
    this.base = track * SAB_STRIDE_TRACK + slot * MAX_EFFECT_PARAMS;
    this.kind = kind;
  }

  // RBJ Audio EQ Cookbook — 2-pole biquad IIR
  private updateCoeffs(cutoff: number, Q: number, sr: number): void {
    const clampedCutoff = Math.max(20, Math.min(sr / 2 - 1, cutoff));
    const clampedQ      = Math.max(0.1, Math.min(20, Q));
    const w0    = 2 * Math.PI * clampedCutoff / sr;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2 * clampedQ);
    const a0    = 1 + alpha;

    if (this.kind === 'lowpass') {
      this.b0 = (1 - cosW0) / 2 / a0;
      this.b1 = (1 - cosW0)     / a0;
      this.b2 = (1 - cosW0) / 2 / a0;
    } else {
      this.b0 =  (1 + cosW0) / 2 / a0;
      this.b1 = -(1 + cosW0)     / a0;
      this.b2 =  (1 + cosW0) / 2 / a0;
    }
    this.a1 = -2 * cosW0  / a0;
    this.a2 = (1 - alpha) / a0;

    this.lastCutoff = cutoff;
    this.lastQ      = Q;
  }

  processBlock(block: Float32Array, len: number, sr: number): void {
    const cutoff = this.sab[this.base + BIQUAD_PARAM.CUTOFF_HZ];
    const Q      = this.sab[this.base + BIQUAD_PARAM.RESONANCE];
    const wet    = this.sab[this.base + BIQUAD_PARAM.WET];

    if (cutoff !== this.lastCutoff || Q !== this.lastQ) {
      this.updateCoeffs(cutoff, Q, sr);
    }

    const dry = 1 - wet;
    const { b0, b1, b2, a1, a2 } = this;
    let { x1, x2, y1, y2 } = this;

    for (let i = 0; i < len; i++) {
      const xn = block[i];
      const yn = b0 * xn + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xn;
      y2 = y1; y1 = yn;
      block[i] = dry * xn + wet * yn;
    }

    this.x1 = x1; this.x2 = x2;
    this.y1 = y1; this.y2 = y2;
  }
}

class DelayEffect implements Effect {
  private sab: Float32Array;
  private base: number;
  private buffer = new Float32Array(MAX_DELAY_SAMPLES);
  private writeHead = 0;

  constructor(sab: Float32Array, track: number, slot: number) {
    this.sab  = sab;
    this.base = track * SAB_STRIDE_TRACK + slot * MAX_EFFECT_PARAMS;
  }

  processBlock(block: Float32Array, len: number, _sr: number): void {
    const time     = Math.max(1, Math.min(MAX_DELAY_SAMPLES - 1, Math.floor(this.sab[this.base + DELAY_PARAM.TIME_SAMPLES])));
    const feedback = Math.max(0, Math.min(0.99, this.sab[this.base + DELAY_PARAM.FEEDBACK]));
    const wet      = this.sab[this.base + DELAY_PARAM.WET];
    const dry      = 1 - wet;

    for (let i = 0; i < len; i++) {
      const xn       = block[i];
      const readHead = (this.writeHead - time + MAX_DELAY_SAMPLES) % MAX_DELAY_SAMPLES;
      const delayed  = this.buffer[readHead];
      this.buffer[this.writeHead] = xn + delayed * feedback;
      this.writeHead = (this.writeHead + 1) % MAX_DELAY_SAMPLES;
      block[i] = dry * xn + wet * delayed;
    }
  }
}

class DistortionEffect implements Effect {
  private sab: Float32Array;
  private base: number;

  constructor(sab: Float32Array, track: number, slot: number) {
    this.sab  = sab;
    this.base = track * SAB_STRIDE_TRACK + slot * MAX_EFFECT_PARAMS;
  }

  processBlock(block: Float32Array, len: number, _sr: number): void {
    const drive = Math.max(0.01, Math.min(100, this.sab[this.base + DIST_PARAM.DRIVE]));
    const wet   = this.sab[this.base + DIST_PARAM.WET];
    const dry   = 1 - wet;

    for (let i = 0; i < len; i++) {
      const xn = block[i];
      block[i] = dry * xn + wet * Math.tanh(xn * drive);
    }
  }
}

export function createEffect(
  cfg: EffectSlotConfig,
  sab: Float32Array,
  track: number,
  slot: number,
): Effect | null {
  if (!cfg.enabled) return null;
  switch (cfg.effectType) {
    case 'lowpass':    return new BiquadEffect(sab, track, slot, 'lowpass');
    case 'highpass':   return new BiquadEffect(sab, track, slot, 'highpass');
    case 'delay':      return new DelayEffect(sab, track, slot);
    case 'distortion': return new DistortionEffect(sab, track, slot);
  }
}
