import { describe, it, expect } from 'vitest';
import { applyEffectSelect } from '../src/Components/Room/AudioBoard/Mixer/Mixer';
import mixerReducer from '../src/Core/State/mixerReducer';
import type { EffectSlotConfig, MixerState, EffectType, Channel } from '../src/Types/AudioState';
import { DEFAULT_EFFECT_PARAMS } from '../src/Types/AudioState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fx(effectType: EffectSlotConfig['effectType']): EffectSlotConfig {
    return { effectType, enabled: true, params: { ...DEFAULT_EFFECT_PARAMS[effectType] } };
}

function makeState(channelId: string, overrides: Partial<{ volume: number; effects: EffectSlotConfig[]; sends: { auxId: string; level: number }[] }> = {}): MixerState {
    return {
        channels: [{
            id: channelId,
            type: 'track',
            volume: overrides.volume ?? 1.0,
            pan: 0,
            mute: false,
            solo: false,
            sends: overrides.sends ?? [],
            effects: overrides.effects ?? [],
        }],
    };
}

// ─── applyEffectSelect ────────────────────────────────────────────────────────

describe('applyEffectSelect', () => {
    it('adds an effect to an empty chain', () => {
        const result = applyEffectSelect([], 0, 'lowpass');
        expect(result).toEqual([fx('lowpass')]);
    });

    it('appends an effect to a non-empty chain', () => {
        const result = applyEffectSelect([fx('lowpass')], 1, 'delay');
        expect(result).toEqual([fx('lowpass'), fx('delay')]);
    });

    it('replaces an effect at a given slot', () => {
        const result = applyEffectSelect([fx('lowpass'), fx('delay')], 0, 'distortion');
        expect(result).toEqual([fx('distortion'), fx('delay')]);
    });

    it('replacing a slot does not remove effects after it', () => {
        const chain = [fx('lowpass'), fx('highpass'), fx('delay')];
        const result = applyEffectSelect(chain, 0, 'distortion');
        expect(result).toEqual([fx('distortion'), fx('highpass'), fx('delay')]);
    });

    it('replacing the middle slot leaves surrounding effects intact', () => {
        const chain = [fx('lowpass'), fx('highpass'), fx('delay')];
        const result = applyEffectSelect(chain, 1, 'distortion');
        expect(result).toEqual([fx('lowpass'), fx('distortion'), fx('delay')]);
    });

    it('deleting a middle effect leaves a null gap — effects after it stay in place', () => {
        const chain = [fx('lowpass'), fx('highpass'), fx('delay')];
        const result = applyEffectSelect(chain, 1, null);
        expect(result).toEqual([fx('lowpass'), null, fx('delay')]);
    });

    it('deleting the first effect leaves a null gap when effects follow', () => {
        const chain = [fx('lowpass'), fx('highpass')];
        const result = applyEffectSelect(chain, 0, null);
        expect(result).toEqual([null, fx('highpass')]);
    });

    it('removes the only effect, leaving an empty chain', () => {
        const result = applyEffectSelect([fx('distortion')], 0, null);
        expect(result).toEqual([]);
    });

    it('removes the last effect without leaving a trailing null', () => {
        const result = applyEffectSelect([fx('lowpass'), fx('delay')], 1, null);
        expect(result).toEqual([fx('lowpass')]);
    });

    it('trims multiple trailing nulls after deletion', () => {
        const chain: (EffectSlotConfig | null)[] = [fx('lowpass'), null, fx('delay')];
        const result = applyEffectSelect(chain, 2, null);
        expect(result).toEqual([fx('lowpass')]);
    });

    it('an effect can be added back into a null gap', () => {
        const chain: (EffectSlotConfig | null)[] = [fx('lowpass'), null, fx('delay')];
        const result = applyEffectSelect(chain, 1, 'distortion');
        expect(result).toEqual([fx('lowpass'), fx('distortion'), fx('delay')]);
    });

    it('does not mutate the original effects array', () => {
        const original = [fx('lowpass'), fx('delay')];
        const copy = [...original];
        applyEffectSelect(original, 0, 'distortion');
        expect(original).toEqual(copy);
    });
});

// ─── mixerReducer ─────────────────────────────────────────────────────────────

describe('mixerReducer — change_channel_volume', () => {
    it('updates volume for the target channel', () => {
        const state = makeState('track-0', { volume: 1.0 });
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        expect(next.channels[0].volume).toBe(0.5);
    });

    it('does not affect other channels', () => {
        const state: MixerState = {
            channels: [
                { id: 'track-0', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [], effects: [] },
                { id: 'track-1', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [], effects: [] },
            ],
        };
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.25 });
        expect(next.channels[1].volume).toBe(1.0);
    });
});

describe('mixerReducer — set_effect_chain', () => {
    it('replaces the effect chain for the target channel', () => {
        const state = makeState('staging', { effects: [fx('lowpass')] });
        const next = mixerReducer(state, {
            type: 'set_effect_chain',
            channelId: 'staging',
            effects: [fx('delay'), fx('distortion')],
        });
        expect(next.channels[0].effects).toEqual([fx('delay'), fx('distortion')]);
    });

    it('clears the effect chain when given an empty array', () => {
        const state = makeState('staging', { effects: [fx('lowpass'), fx('delay')] });
        const next = mixerReducer(state, { type: 'set_effect_chain', channelId: 'staging', effects: [] });
        expect(next.channels[0].effects).toEqual([]);
    });
});

// ─── bounce / restage / delete helpers ───────────────────────────────────────

const DEFAULT_SENDS = [{ auxId: 'aux-0', level: 0 }, { auxId: 'aux-1', level: 0 }];

function makeFullState(): MixerState {
    return {
        channels: [
            { id: 'staging', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('lowpass'), fx('delay')] },
            { id: 'track-0', type: 'track', trackIndex: 0, volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [] },
            { id: 'track-1', type: 'track', trackIndex: 1, volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('distortion')] },
            { id: 'track-2', type: 'track', trackIndex: 2, volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('highpass')] },
            { id: 'master', type: 'master', volume: 1.0, pan: 0, mute: false, solo: false, sends: [], effects: [] },
        ],
    };
}

describe('mixerReducer — bounce_effects', () => {
    it('copies staging effects and sends to the new track channel', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: 'track-0' });
        const track0 = next.channels.find((ch: Channel) => ch.id === 'track-0')!;
        expect(track0.effects).toEqual([fx('lowpass'), fx('delay')]);
        expect(track0.sends).toEqual(DEFAULT_SENDS);
    });

    it('clears staging effects after bounce', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: 'track-0' });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.effects).toEqual([]);
    });

    it('resets staging sends to defaults after bounce', () => {
        const state: MixerState = {
            channels: [
                { id: 'staging', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [{ auxId: 'aux-1', level: 0.8 }, { auxId: 'aux-2', level: 0.3 }], effects: [fx('delay')] },
                { id: 'track-0', type: 'track', trackIndex: 0, volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [] },
            ],
        };
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: 'track-0' });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.sends).toEqual(DEFAULT_SENDS);
    });

    it('does not affect other channels', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: 'track-0' });
        const track1 = next.channels.find((ch: Channel) => ch.id === 'track-1')!;
        expect(track1.effects).toEqual([fx('distortion')]);
    });

    it('does not mutate original state', () => {
        const state = makeFullState();
        mixerReducer(state, { type: 'bounce_effects', newTrackId: 'track-0' });
        expect(state.channels.find((ch: Channel) => ch.id === 'staging')!.effects).toEqual([fx('lowpass'), fx('delay')]);
    });
});

describe('mixerReducer — restage_effects', () => {
    it('copies track effects and sends to staging', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'restage_effects', trackId: 'track-1' });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.effects).toEqual([fx('distortion')]);
        expect(staging.sends).toEqual(DEFAULT_SENDS);
    });

    it('clears the restaged track effects', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'restage_effects', trackId: 'track-1' });
        const track1 = next.channels.find((ch: Channel) => ch.id === 'track-1')!;
        expect(track1.effects).toEqual([]);
    });

    it('resets track sends to defaults after restage', () => {
        const state: MixerState = {
            channels: [
                { id: 'staging', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [] },
                { id: 'track-0', type: 'track', trackIndex: 0, volume: 1.0, pan: 0, mute: false, solo: false, sends: [{ auxId: 'aux-2', level: 0.6 }, { auxId: 'aux-1', level: 0.2 }], effects: [fx('highpass')] },
            ],
        };
        const next = mixerReducer(state, { type: 'restage_effects', trackId: 'track-0' });
        const track0 = next.channels.find((ch: Channel) => ch.id === 'track-0')!;
        expect(track0.sends).toEqual(DEFAULT_SENDS);
    });

    it('overwrites existing staging effects', () => {
        const state = makeFullState(); // staging starts with [lowpass, delay]
        const next = mixerReducer(state, { type: 'restage_effects', trackId: 'track-2' });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.effects).toEqual([fx('highpass')]);
    });

    it('does not affect unrelated channels', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'restage_effects', trackId: 'track-1' });
        const track2 = next.channels.find((ch: Channel) => ch.id === 'track-2')!;
        expect(track2.effects).toEqual([fx('highpass')]);
    });

    it('does not mutate original state', () => {
        const state = makeFullState();
        mixerReducer(state, { type: 'restage_effects', trackId: 'track-1' });
        expect(state.channels.find((ch: Channel) => ch.id === 'track-1')!.effects).toEqual([fx('distortion')]);
    });
});

describe('mixerReducer — delete_bounce_channels', () => {
    it('reduces the track count by the number of deleted indices', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [1] });
        expect(next.channels.filter((ch: Channel) => ch.id.startsWith('track-'))).toHaveLength(2);
    });

    it('reindexes surviving tracks contiguously', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [1] });
        const trackIds = next.channels.filter((ch: Channel) => ch.id.startsWith('track-')).map((ch: Channel) => ch.id);
        expect(trackIds).toEqual(['track-0', 'track-1']);
    });

    it('former track-2 becomes track-1 when track-1 is deleted, preserving its effects', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [1] });
        const newTrack1 = next.channels.find((ch: Channel) => ch.id === 'track-1')!;
        expect(newTrack1.effects).toEqual([fx('highpass')]);
    });

    it('deletes multiple indices at once and reindexes correctly', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [0, 2] });
        const trackIds = next.channels.filter((ch: Channel) => ch.id.startsWith('track-')).map((ch: Channel) => ch.id);
        expect(trackIds).toEqual(['track-0']);
        expect(next.channels.find((ch: Channel) => ch.id === 'track-0')!.effects).toEqual([fx('distortion')]);
    });

    it('deleting all tracks leaves no track channels', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [0, 1, 2] });
        expect(next.channels.filter((ch: Channel) => ch.id.startsWith('track-'))).toHaveLength(0);
    });

    it('does not affect non-track channels (staging, master)', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [0, 1, 2] });
        expect(next.channels.find((ch: Channel) => ch.id === 'staging')).toBeDefined();
        expect(next.channels.find((ch: Channel) => ch.id === 'master')).toBeDefined();
    });

    it('does not mutate original state', () => {
        const state = makeFullState();
        mixerReducer(state, { type: 'delete_bounce_channels', deletedIndices: [0] });
        expect(state.channels.filter((ch: Channel) => ch.id.startsWith('track-'))).toHaveLength(3);
    });
});

describe('mixerReducer — update_aux_send', () => {
    it('updates the level of an existing send', () => {
        const state = makeState('staging', {
            sends: [{ auxId: 'aux-0', level: 0 }, { auxId: 'aux-1', level: 0 }],
        });
        const next = mixerReducer(state, {
            type: 'update_aux_send',
            channelId: 'staging',
            sendIndex: 0,
            auxId: 'aux-0',
            level: 0.75,
        });
        expect(next.channels[0].sends[0]).toEqual({ auxId: 'aux-0', level: 0.75 });
        expect(next.channels[0].sends[1]).toEqual({ auxId: 'aux-1', level: 0 });
    });

    it('changes the target aux bus of a send', () => {
        const state = makeState('staging', {
            sends: [{ auxId: 'aux-0', level: 0.5 }],
        });
        const next = mixerReducer(state, {
            type: 'update_aux_send',
            channelId: 'staging',
            sendIndex: 0,
            auxId: 'aux-2',
            level: 0.5,
        });
        expect(next.channels[0].sends[0].auxId).toBe('aux-2');
    });

    it('does not mutate the original state', () => {
        const state = makeState('staging', {
            sends: [{ auxId: 'aux-0', level: 0 }],
        });
        mixerReducer(state, {
            type: 'update_aux_send',
            channelId: 'staging',
            sendIndex: 0,
            auxId: 'aux-0',
            level: 1.0,
        });
        expect(state.channels[0].sends[0].level).toBe(0);
    });
});
