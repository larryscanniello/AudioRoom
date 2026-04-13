import { describe, it, expect, vi } from 'vitest';
import { Bounce } from '../src/Core/Events/Audio/Bounce';
import { ReStage } from '../src/Core/Events/Audio/ReStage';
import type { BounceLayer, Channel, ChannelType, EffectSlotConfig, EffectType, MixerState } from '../src/Types/AudioState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLayer(id: string): BounceLayer {
    return { id, name: id, regions: [] };
}

function fx(effectType: string): EffectSlotConfig {
    return { effectType: effectType as EffectType, enabled: true, params: {} };
}

function makeChannel(id: string, type: ChannelType, effects: (EffectSlotConfig | null)[] = []): Channel {
    return { id, type, volume: 1.0, pan: 0, mute: false, solo: false, sends: [], effects };
}

function makeSnapshot(bounceLayers: BounceLayer[], channels: Channel[]) {
    const mixerState: MixerState = { channels };
    return {
        snapshot: {
            timeline: { mix: bounceLayers, staging: [[]] },
            mixerState,
            bounce: 1,
        },
    };
}

function makeEngine() {
    return {
        bounce: vi.fn(),
        reStage: vi.fn(),
        setEffectChain: vi.fn(),
        setStagingEffectChain: vi.fn(),
        syncMixerVolumes: vi.fn(),
        // other AudioEngine methods not under test
        play: vi.fn(), record: vi.fn(), stop: vi.fn(), regenerateMixMipmap: vi.fn(),
        toggleMetronome: vi.fn(), otherPersonRecording: vi.fn(), startLatencyTest: vi.fn(),
        setMixMuted: vi.fn(), setStagingMuted: vi.fn(), setMixVolume: vi.fn(),
        setStagingVolume: vi.fn(), setStagingMixerVolume: vi.fn(), init: vi.fn(),
        setEffectParam: vi.fn(), setStagingEffectParam: vi.fn(),
        setMixMasterVolume: vi.fn(), setStagingMasterVolume: vi.fn(),
    };
}

// ─── Bounce.executeAudio ──────────────────────────────────────────────────────

describe('Bounce.executeAudio — effect chain wiring', () => {
    it('calls setEffectChain for a bounce track that carries effects', () => {
        const engine = makeEngine();
        const layer = makeLayer('uuid-0');
        const effect = fx('lowpass');
        const data = makeSnapshot(
            [layer],
            [makeChannel('staging', 'track'), makeChannel('uuid-0', 'track', [effect])],
        );
        Bounce.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledOnce();
        expect(engine.setEffectChain).toHaveBeenCalledWith(0, [effect]);
    });

    it('does not call setEffectChain for a bounce track with no effects', () => {
        const engine = makeEngine();
        const layer = makeLayer('uuid-0');
        const data = makeSnapshot(
            [layer],
            [makeChannel('staging', 'track'), makeChannel('uuid-0', 'track', [])],
        );
        Bounce.executeAudio(engine as any, data);
        expect(engine.setEffectChain).not.toHaveBeenCalled();
    });

    it('assigns effects to the correct track index when multiple bounce tracks exist', () => {
        const engine = makeEngine();
        const layerA = makeLayer('uuid-a');
        const layerB = makeLayer('uuid-b');
        const effect = fx('highpass');
        const data = makeSnapshot(
            [layerA, layerB],
            [
                makeChannel('staging', 'track'),
                makeChannel('uuid-a', 'track', []),
                makeChannel('uuid-b', 'track', [effect]),
            ],
        );
        Bounce.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledOnce();
        expect(engine.setEffectChain).toHaveBeenCalledWith(1, [effect]);
    });

    it('wires effects for every bounce track that has them', () => {
        const engine = makeEngine();
        const layerA = makeLayer('uuid-a');
        const layerB = makeLayer('uuid-b');
        const fxA = fx('lowpass');
        const fxB = fx('highpass');
        const data = makeSnapshot(
            [layerA, layerB],
            [
                makeChannel('staging', 'track'),
                makeChannel('uuid-a', 'track', [fxA]),
                makeChannel('uuid-b', 'track', [fxB]),
            ],
        );
        Bounce.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledTimes(2);
        expect(engine.setEffectChain).toHaveBeenCalledWith(0, [fxA]);
        expect(engine.setEffectChain).toHaveBeenCalledWith(1, [fxB]);
    });

    it('does not call setEffectChain for the staging channel', () => {
        const engine = makeEngine();
        const layer = makeLayer('uuid-0');
        const effect = fx('lowpass');
        const data = makeSnapshot(
            [layer],
            [makeChannel('staging', 'track', [effect]), makeChannel('uuid-0', 'track', [])],
        );
        Bounce.executeAudio(engine as any, data);
        // staging effects should NOT be wired via setEffectChain (that is setStagingEffectChain's job)
        expect(engine.setEffectChain).not.toHaveBeenCalled();
    });

    it('always calls engine.bounce', () => {
        const engine = makeEngine();
        const data = makeSnapshot([makeLayer('uuid-0')], [makeChannel('staging', 'track'), makeChannel('uuid-0', 'track')]);
        Bounce.executeAudio(engine as any, data);
        expect(engine.bounce).toHaveBeenCalledOnce();
    });
});

// ─── ReStage.executeAudio ─────────────────────────────────────────────────────

describe('ReStage.executeAudio — effect chain wiring', () => {
    it('calls setStagingEffectChain with the staging channel effects', () => {
        const engine = makeEngine();
        const effect = fx('lowpass');
        const data = makeSnapshot(
            [],
            [makeChannel('staging', 'track', [effect])],
        );
        ReStage.executeAudio(engine as any, data);
        expect(engine.setStagingEffectChain).toHaveBeenCalledWith([effect]);
    });

    it('calls setStagingEffectChain with empty array when staging has no effects', () => {
        const engine = makeEngine();
        const data = makeSnapshot([], [makeChannel('staging', 'track', [])]);
        ReStage.executeAudio(engine as any, data);
        expect(engine.setStagingEffectChain).toHaveBeenCalledWith([]);
    });

    it('re-applies effect chains for all remaining bounce tracks', () => {
        const engine = makeEngine();
        const layerA = makeLayer('uuid-a');
        const layerB = makeLayer('uuid-b');
        const fxA = fx('lowpass');
        const fxB = fx('highpass');
        const data = makeSnapshot(
            [layerA, layerB],
            [
                makeChannel('staging', 'track'),
                makeChannel('uuid-a', 'track', [fxA]),
                makeChannel('uuid-b', 'track', [fxB]),
            ],
        );
        ReStage.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledWith(0, [fxA]);
        expect(engine.setEffectChain).toHaveBeenCalledWith(1, [fxB]);
    });

    it('clears the vacated slot left by the removed track', () => {
        const engine = makeEngine();
        // After restaging: 2 tracks remain, so slot 2 should be cleared
        const data = makeSnapshot(
            [makeLayer('uuid-a'), makeLayer('uuid-b')],
            [makeChannel('staging', 'track'), makeChannel('uuid-a', 'track'), makeChannel('uuid-b', 'track')],
        );
        ReStage.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledWith(2, []);
    });

    it('clears slot 0 when all bounce tracks are restaged', () => {
        const engine = makeEngine();
        const data = makeSnapshot([], [makeChannel('staging', 'track')]);
        ReStage.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledWith(0, []);
    });

    it('re-indexes correctly when a middle track is removed — surviving tracks use new indices', () => {
        // Before: [A=0, B=1, C=2]. B is restaged → After: [A=0, C=1].
        // C must now be wired at index 1, not its old index 2.
        const engine = makeEngine();
        const layerA = makeLayer('uuid-a');
        const layerC = makeLayer('uuid-c'); // B was restaged, C slides from 2 → 1
        const fxC = fx('highpass');
        const data = makeSnapshot(
            [layerA, layerC],
            [makeChannel('staging', 'track'), makeChannel('uuid-a', 'track', []), makeChannel('uuid-c', 'track', [fxC])],
        );
        ReStage.executeAudio(engine as any, data);
        expect(engine.setEffectChain).toHaveBeenCalledWith(1, [fxC]); // C is now at index 1
        // slot 2 (vacated) must be cleared
        expect(engine.setEffectChain).toHaveBeenCalledWith(2, []);
    });

    it('calls syncMixerVolumes', () => {
        const engine = makeEngine();
        const layerA = makeLayer('uuid-a');
        const channels = [makeChannel('staging', 'track'), makeChannel('uuid-a', 'track')];
        const data = makeSnapshot([layerA], channels);
        ReStage.executeAudio(engine as any, data);
        expect(engine.syncMixerVolumes).toHaveBeenCalledOnce();
    });

    it('always calls engine.reStage', () => {
        const engine = makeEngine();
        const data = makeSnapshot([], [makeChannel('staging', 'track')]);
        ReStage.executeAudio(engine as any, data);
        expect(engine.reStage).toHaveBeenCalledOnce();
    });
});