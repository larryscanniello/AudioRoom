import { describe, it, expect } from 'vitest';
import mixerReducer from '../src/Core/State/mixerReducer';
import type { MixerState, Channel } from '../src/Types/AudioState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChannel(overrides: Partial<Channel> & { id: string }): Channel {
    return {
        type: 'track',
        volume: 1.0,
        pan: 0,
        mute: false,
        solo: false,
        sends: [],
        ...overrides,
    };
}

function defaultState(): MixerState {
    return {
        channels: [
            makeChannel({ id: 'staging' }),
            makeChannel({ id: 'track-0', trackIndex: 0 }),
            makeChannel({ id: 'track-1', trackIndex: 1 }),
            makeChannel({ id: 'aux-0', type: 'aux' }),
            makeChannel({ id: 'master', type: 'master' }),
        ],
    };
}

// ─── change_channel_volume ────────────────────────────────────────────────────

describe('change_channel_volume', () => {
    it('updates volume of the target channel', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        const ch = next.channels.find(c => c.id === 'track-0')!;
        expect(ch.volume).toBe(0.5);
    });

    it('does not mutate other channels', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        const unchanged = next.channels.filter(c => c.id !== 'track-0');
        for (const ch of unchanged) {
            expect(ch.volume).toBe(1.0);
        }
    });

    it('returns a new state object (immutable)', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        expect(next).not.toBe(state);
        expect(next.channels).not.toBe(state.channels);
    });

    it('returns new channel object for the changed channel', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        const orig = state.channels.find(c => c.id === 'track-0')!;
        const updated = next.channels.find(c => c.id === 'track-0')!;
        expect(updated).not.toBe(orig);
    });

    it('preserves reference equality for unchanged channel objects', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        const origStaging = state.channels.find(c => c.id === 'staging')!;
        const nextStaging = next.channels.find(c => c.id === 'staging')!;
        expect(nextStaging).toBe(origStaging);
    });

    it('updates staging channel volume', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'staging', volume: 0.25 });
        expect(next.channels.find(c => c.id === 'staging')!.volume).toBe(0.25);
    });

    it('updates master channel volume', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'master', volume: 0.8 });
        expect(next.channels.find(c => c.id === 'master')!.volume).toBe(0.8);
    });

    it('updates aux channel volume', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'aux-0', volume: 0.6 });
        expect(next.channels.find(c => c.id === 'aux-0')!.volume).toBe(0.6);
    });

    it('clamps to 0 (does not clip at low end — reducer is not responsible for clamping)', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0 });
        expect(next.channels.find(c => c.id === 'track-0')!.volume).toBe(0);
    });

    it('accepts maximum volume of 1.0', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 1.0 });
        expect(next.channels.find(c => c.id === 'track-0')!.volume).toBe(1.0);
    });

    it('does not change any other channel fields when updating volume', () => {
        const state = defaultState();
        const before = state.channels.find(c => c.id === 'track-0')!;
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.3 });
        const after = next.channels.find(c => c.id === 'track-0')!;
        expect(after.pan).toBe(before.pan);
        expect(after.mute).toBe(before.mute);
        expect(after.solo).toBe(before.solo);
        expect(after.type).toBe(before.type);
        expect(after.trackIndex).toBe(before.trackIndex);
        expect(after.sends).toBe(before.sends);
    });

    it('preserves channel count', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        expect(next.channels.length).toBe(state.channels.length);
    });

    it('no-ops gracefully when channelId does not exist', () => {
        const state = defaultState();
        const next = mixerReducer(state, { type: 'change_channel_volume', channelId: 'nonexistent', volume: 0.5 });
        expect(next.channels.every(ch => ch.volume === 1.0)).toBe(true);
    });

    it('successive volume changes compose correctly', () => {
        let state = defaultState();
        state = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.5 });
        state = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.75 });
        expect(state.channels.find(c => c.id === 'track-0')!.volume).toBe(0.75);
    });

    it('changing two different channels independently', () => {
        let state = defaultState();
        state = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-0', volume: 0.3 });
        state = mixerReducer(state, { type: 'change_channel_volume', channelId: 'track-1', volume: 0.7 });
        expect(state.channels.find(c => c.id === 'track-0')!.volume).toBe(0.3);
        expect(state.channels.find(c => c.id === 'track-1')!.volume).toBe(0.7);
    });
});