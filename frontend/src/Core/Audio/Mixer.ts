import type { GlobalContext } from "../Mediator";
import type { BounceLayer, MixerState, EffectSlotConfig } from "@/Types/AudioState";
import { NATIVE_EFFECT_CATALOG, type NativeEffectType } from "@/Core/Effects/effectCatalog";

export class Mixer {
    _audioContext: AudioContext;
    #processorNode: AudioWorkletNode;
    #masterGain: GainNode;
    #stagingGain: GainNode;
    #metronomeGain: GainNode;
    #trackGains: GainNode[];
    #effectNodes: (AudioNode | null)[][];
    #stagingEffectNodes: (AudioNode | null)[];
    #params: Map<string, AudioParam>;
    #mixMasterVolume: { param: AudioParam; muted: boolean };
    #stagingMasterVolume: { param: AudioParam; muted: boolean };
    #context: GlobalContext;

    constructor(
        numberOfMixTracks: number,
        audioContext: AudioContext,
        processorNode: AudioWorkletNode,
        context: GlobalContext
    ) {
        this._audioContext = audioContext;
        this.#processorNode = processorNode;
        this.#context = context;

        this.#masterGain = audioContext.createGain();
        this.#stagingGain = audioContext.createGain();
        this.#metronomeGain = audioContext.createGain();
        this.#trackGains = Array.from({ length: numberOfMixTracks }, () => audioContext.createGain());
        this.#effectNodes = Array.from({ length: numberOfMixTracks }, () => []);
        this.#stagingEffectNodes = [];

        this.#params = new Map();
        this.#params.set('master', this.#masterGain.gain);
        this.#params.set('staging', this.#stagingGain.gain);
        this.#trackGains.forEach((g, i) => this.#params.set(`track-${i}`, g.gain));

        this.#mixMasterVolume = { param: this.#masterGain.gain, muted: false };
        this.#stagingMasterVolume = { param: this.#stagingGain.gain, muted: false };
    }

    public initGraph(): void {
        const n = this.#trackGains.length;
        for (let i = 0; i < n; i++) {
            this.#processorNode.connect(this.#trackGains[i], i, 0);
            this.#trackGains[i].connect(this.#masterGain);
        }
        this.#processorNode.connect(this.#stagingGain, n, 0);
        this.#stagingGain.connect(this.#masterGain);
        this.#processorNode.connect(this.#metronomeGain, n + 1, 0);
        this.#metronomeGain.connect(this._audioContext.destination);
        this.#masterGain.connect(this._audioContext.destination);
    }

    public setEffectChain(trackIndex: number, chain: (EffectSlotConfig | null)[]): void {
        const trackGain = this.#trackGains[trackIndex];
        try { this.#processorNode.disconnect(trackIndex); } catch (_) {}
        for (const node of this.#effectNodes[trackIndex]) {
            if (node) try { node.disconnect(); } catch (_) {}
        }
        const newNodes = chain.map(cfg => cfg ? this.#createEffectNode(cfg) : null);
        this.#effectNodes[trackIndex] = newNodes;
        const active = newNodes.filter((n): n is AudioNode => n !== null);
        if (active.length === 0) {
            this.#processorNode.connect(trackGain, trackIndex, 0);
        } else {
            this.#processorNode.connect(active[0], trackIndex, 0);
            for (let i = 0; i < active.length - 1; i++) active[i].connect(active[i + 1]);
            active[active.length - 1].connect(trackGain);
        }
    }

    #createEffectNode(cfg: EffectSlotConfig): AudioNode {
        const defaults = NATIVE_EFFECT_CATALOG[cfg.effectType as NativeEffectType]?.params;
        switch (cfg.effectType) {
            case 'lowpass':
                return new BiquadFilterNode(this._audioContext, {
                    type: 'lowpass',
                    frequency: cfg.params?.cutoffHz ?? defaults?.cutoffHz.default ?? 2000,
                    Q: cfg.params?.resonance ?? defaults?.resonance.default ?? 0.7,
                });
            case 'highpass':
                return new BiquadFilterNode(this._audioContext, {
                    type: 'highpass',
                    frequency: cfg.params?.cutoffHz ?? defaults?.cutoffHz.default ?? 200,
                    Q: cfg.params?.resonance ?? defaults?.resonance.default ?? 0.7,
                });
            default:
                return new GainNode(this._audioContext, { gain: 1 });
        }
    }

    public setEffectParam(trackIndex: number, slotIndex: number, paramName: string, value: number): void {
        const node = this.#effectNodes[trackIndex]?.[slotIndex];
        if (!node) return;
        if (node instanceof BiquadFilterNode) {
            if (paramName === 'cutoffHz') node.frequency.value = value;
            if (paramName === 'resonance') node.Q.value = value;
        }
    }

    public setStagingEffectChain(chain: (EffectSlotConfig | null)[]): void {
        const n = this.#trackGains.length; // staging output index
        try { this.#processorNode.disconnect(n); } catch (_) {}
        for (const node of this.#stagingEffectNodes) {
            if (node) try { node.disconnect(); } catch (_) {}
        }
        const newNodes = chain.map(cfg => cfg ? this.#createEffectNode(cfg) : null);
        this.#stagingEffectNodes = newNodes;
        const active = newNodes.filter((node): node is AudioNode => node !== null);
        if (active.length === 0) {
            this.#processorNode.connect(this.#stagingGain, n, 0);
        } else {
            this.#processorNode.connect(active[0], n, 0);
            for (let i = 0; i < active.length - 1; i++) active[i].connect(active[i + 1]);
            active[active.length - 1].connect(this.#stagingGain);
        }
    }

    public setStagingEffectParam(slotIndex: number, paramName: string, value: number): void {
        const node = this.#stagingEffectNodes[slotIndex];
        if (!node) return;
        if (node instanceof BiquadFilterNode) {
            if (paramName === 'cutoffHz') node.frequency.value = value;
            if (paramName === 'resonance') node.Q.value = value;
        }
    }

    public toggleMetronome(isOn: boolean): void {
        this.#metronomeGain.gain.value = isOn ? 1 : 0;
    }

    syncMixerVolumes(mixerState: MixerState, bounceLayers: readonly BounceLayer[]): void {
        for (const channel of mixerState.channels) {
            if (channel.type === 'track' && channel.id !== 'staging') {
                const idx = bounceLayers.findIndex(l => l.id === channel.id);
                if (idx >= 0 && idx < this.#trackGains.length) {
                    this.#trackGains[idx].gain.value = channel.volume;
                }
            } else {
                const param = this.#params.get(channel.id);
                if (param) param.value = channel.volume;
            }
        }
    }

    setStagingMasterVolume(volume: number) {
        if (!this.#stagingMasterVolume.muted) {
            this.#stagingMasterVolume.param.value = volume;
        }
    }

    setMixMasterVolume(volume: number) {
        if (!this.#mixMasterVolume.muted) {
            this.#mixMasterVolume.param.value = volume;
        }
    }

    setStagingMuted(muted: boolean) {
        this.#stagingMasterVolume.muted = muted;
        this.#stagingMasterVolume.param.value = muted ? 0 : this.#context.query("stagingMasterVolume");
    }

    setMixMuted(muted: boolean) {
        this.#mixMasterVolume.muted = muted;
        this.#mixMasterVolume.param.value = muted ? 0 : this.#context.query("mixMasterVolume");
    }
}