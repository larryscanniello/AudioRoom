import { describe, it, expect } from 'vitest';
import { applyEffectSelect } from '../src/Components/Room/AudioBoard/Mixer/Mixer';
import mixerReducer from '../src/Core/State/mixerReducer';
import type { EffectSlotConfig, MixerState, EffectType, Channel } from '../src/Types/AudioState';
import { DEFAULT_EFFECT_PARAMS } from '../src/Core/Effects/effectCatalog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fx(effectType: string): EffectSlotConfig {
    const defaultParams = (DEFAULT_EFFECT_PARAMS as Record<string, Record<string, number>>)[effectType] ?? {};
    return { effectType: effectType as EffectType, enabled: true, params: { ...defaultParams } };
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
        const result = applyEffectSelect([fx('lowpass')], 1, 'delay' as EffectType);
        expect(result).toEqual([fx('lowpass'), fx('delay')]);
    });

    it('replaces an effect at a given slot', () => {
        const result = applyEffectSelect([fx('lowpass'), fx('delay')], 0, 'distortion' as EffectType);
        expect(result).toEqual([fx('distortion'), fx('delay')]);
    });

    it('replacing a slot does not remove effects after it', () => {
        const chain = [fx('lowpass'), fx('highpass'), fx('delay')];
        const result = applyEffectSelect(chain, 0, 'distortion' as EffectType);
        expect(result).toEqual([fx('distortion'), fx('highpass'), fx('delay')]);
    });

    it('replacing the middle slot leaves surrounding effects intact', () => {
        const chain = [fx('lowpass'), fx('highpass'), fx('delay')];
        const result = applyEffectSelect(chain, 1, 'distortion' as EffectType);
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
        const result = applyEffectSelect(chain, 1, 'distortion' as EffectType);
        expect(result).toEqual([fx('lowpass'), fx('distortion'), fx('delay')]);
    });

    it('does not mutate the original effects array', () => {
        const original = [fx('lowpass'), fx('delay')];
        const copy = [...original];
        applyEffectSelect(original, 0, 'distortion' as EffectType);
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

const UUID_0 = 'uuid-track-0';
const UUID_1 = 'uuid-track-1';
const UUID_2 = 'uuid-track-2';

function makeFullState(): MixerState {
    return {
        channels: [
            { id: 'staging', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('lowpass'), fx('delay')] },
            { id: UUID_0, type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [] },
            { id: UUID_1, type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('distortion')] },
            { id: UUID_2, type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('highpass')] },
            { id: 'master', type: 'master', volume: 1.0, pan: 0, mute: false, solo: false, sends: [], effects: [] },
        ],
    };
}

describe('mixerReducer — bounce_effects', () => {
    it('creates a new channel with staging effects and sends', () => {
        const state: MixerState = {
            channels: [
                { id: 'staging', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [...DEFAULT_SENDS], effects: [fx('lowpass'), fx('delay')] },
            ],
        };
        const newId = 'new-bounce-uuid';
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: newId });
        const newChannel = next.channels.find((ch: Channel) => ch.id === newId)!;
        expect(newChannel).toBeDefined();
        expect(newChannel.effects).toEqual([fx('lowpass'), fx('delay')]);
        expect(newChannel.sends).toEqual(DEFAULT_SENDS);
    });

    it('appends the new channel (does not replace existing ones)', () => {
        const state = makeFullState();
        const newId = 'brand-new-uuid';
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: newId });
        expect(next.channels.find((ch: Channel) => ch.id === UUID_0)).toBeDefined();
        expect(next.channels.find((ch: Channel) => ch.id === UUID_1)).toBeDefined();
        expect(next.channels.find((ch: Channel) => ch.id === newId)).toBeDefined();
    });

    it('clears staging effects after bounce', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: 'new-uuid' });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.effects).toEqual([]);
    });

    it('resets staging sends to defaults after bounce', () => {
        const state: MixerState = {
            channels: [
                { id: 'staging', type: 'track', volume: 1.0, pan: 0, mute: false, solo: false, sends: [{ auxId: 'aux-1', level: 0.8 }, { auxId: 'aux-2', level: 0.3 }], effects: [fx('delay')] },
            ],
        };
        const next = mixerReducer(state, { type: 'bounce_effects', newTrackId: 'new-uuid' });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.sends).toEqual(DEFAULT_SENDS);
    });

    it('does not mutate original state', () => {
        const state = makeFullState();
        mixerReducer(state, { type: 'bounce_effects', newTrackId: 'new-uuid' });
        expect(state.channels.find((ch: Channel) => ch.id === 'staging')!.effects).toEqual([fx('lowpass'), fx('delay')]);
    });
});

describe('mixerReducer — restage_effects', () => {
    it('copies track effects and sends to staging', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'restage_effects', trackId: UUID_1 });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.effects).toEqual([fx('distortion')]);
        expect(staging.sends).toEqual(DEFAULT_SENDS);
    });

    it('removes the restaged track channel', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'restage_effects', trackId: UUID_1 });
        expect(next.channels.find((ch: Channel) => ch.id === UUID_1)).toBeUndefined();
    });

    it('overwrites existing staging effects', () => {
        const state = makeFullState(); // staging starts with [lowpass, delay]
        const next = mixerReducer(state, { type: 'restage_effects', trackId: UUID_2 });
        const staging = next.channels.find((ch: Channel) => ch.id === 'staging')!;
        expect(staging.effects).toEqual([fx('highpass')]);
    });

    it('does not affect unrelated channels', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'restage_effects', trackId: UUID_1 });
        const track2 = next.channels.find((ch: Channel) => ch.id === UUID_2)!;
        expect(track2.effects).toEqual([fx('highpass')]);
    });

    it('does not mutate original state', () => {
        const state = makeFullState();
        mixerReducer(state, { type: 'restage_effects', trackId: UUID_1 });
        expect(state.channels.find((ch: Channel) => ch.id === UUID_1)!.effects).toEqual([fx('distortion')]);
    });
});

describe('mixerReducer — delete_bounce_channels', () => {
    it('removes channels by UUID', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIds: [UUID_1] });
        expect(next.channels.find((ch: Channel) => ch.id === UUID_1)).toBeUndefined();
        expect(next.channels.find((ch: Channel) => ch.id === UUID_0)).toBeDefined();
        expect(next.channels.find((ch: Channel) => ch.id === UUID_2)).toBeDefined();
    });

    it('surviving channels keep their original IDs (no re-indexing)', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIds: [UUID_1] });
        expect(next.channels.find((ch: Channel) => ch.id === UUID_2)!.effects).toEqual([fx('highpass')]);
    });

    it('deletes multiple ids at once', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIds: [UUID_0, UUID_2] });
        expect(next.channels.find((ch: Channel) => ch.id === UUID_0)).toBeUndefined();
        expect(next.channels.find((ch: Channel) => ch.id === UUID_2)).toBeUndefined();
        expect(next.channels.find((ch: Channel) => ch.id === UUID_1)!.effects).toEqual([fx('distortion')]);
    });

    it('deleting all track channels leaves only non-track channels', () => {
        const state = makeFullState();
        const next = mixerReducer(state, { type: 'delete_bounce_channels', deletedIds: [UUID_0, UUID_1, UUID_2] });
        expect(next.channels.find((ch: Channel) => ch.id === 'staging')).toBeDefined();
        expect(next.channels.find((ch: Channel) => ch.id === 'master')).toBeDefined();
        expect(next.channels.filter((ch: Channel) => ch.type === 'track' && ch.id !== 'staging')).toHaveLength(0);
    });

    it('does not mutate original state', () => {
        const state = makeFullState();
        mixerReducer(state, { type: 'delete_bounce_channels', deletedIds: [UUID_0] });
        expect(state.channels.find((ch: Channel) => ch.id === UUID_0)).toBeDefined();
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
