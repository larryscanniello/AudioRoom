import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import timelineReducer from '../src/Core/State/timelineReducer';
import type { TimelineState, Region } from "../src/Types/AudioState";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRegion(overrides: Partial<Region> & { start: number; end: number }): Region {
    return {
        id: crypto.randomUUID(),
        take: 0,
        bounce: 0,
        name: 'bounce_0_take_0',
        clipOffset: 0,
        latencyOffset: 0,
        audioLength: overrides.end - overrides.start,
        ...overrides,
    };
}

function emptyState(): TimelineState {
    return {
        staging: [[]],
        mix: [],
        undoStack: [],
        redoStack: [],
        lastRecordedRegion: null,
        lastMipmapRanges: [],
    };
}

function stateWithStaging(regions: Region[]): TimelineState {
    return { ...emptyState(), staging: [regions] };
}

// Convenience: dispatch add_region and return new state
function addRegion(state: TimelineState, opts: {
    start: number; end: number; take?: number; bounce?: number;
    fileName?: string; delayCompensation?: number;
}): TimelineState {
    return timelineReducer(state, {
        type: 'add_region',
        data: {
            timelineStart: opts.start,
            timelineEnd: opts.end,
            takeNumber: opts.take ?? 0,
            bounceNumber: opts.bounce ?? 0,
            fileName: opts.fileName ?? 'bounce_0_take_0',
            delayCompensation: opts.delayCompensation ?? 0,
        },
    });
}

// ─── add_region ───────────────────────────────────────────────────────────────

describe('add_region', () => {
    it('adds a region to an empty timeline', () => {
        const state = addRegion(emptyState(), { start: 0, end: 10 });
        expect(state.staging[0]).toHaveLength(1);
        expect(state.staging[0][0]).toMatchObject({ start: 0, end: 10 });
    });

    it('sets clipOffset=0, latencyOffset=delayCompensation, audioLength=end-start', () => {
        const state = addRegion(emptyState(), { start: 0, end: 100, delayCompensation: 42 });
        const r = state.staging[0][0];
        expect(r.clipOffset).toBe(0);
        expect(r.latencyOffset).toBe(42);
        expect(r.audioLength).toBe(100);
    });

    it('does not add a region when end <= start', () => {
        const s0 = emptyState();
        const s1 = addRegion(s0, { start: 5, end: 5 });
        expect(s1).toBe(s0);
        const s2 = addRegion(s0, { start: 10, end: 5 });
        expect(s2).toBe(s0);
    });

    it('handles regions adjacent at boundary', () => {
        let state = addRegion(emptyState(), { start: 0, end: 10 });
        state = addRegion(state, { start: 10, end: 20 });
        expect(state.staging[0].map(r => [r.start, r.end])).toEqual([[0, 10], [10, 20]]);
    });

    it('clips existing region when new region is contained inside it', () => {
        let state = addRegion(emptyState(), { start: 0, end: 10 });
        state = addRegion(state, { start: 2, end: 8 });
        const se = state.staging[0].map(r => [r.start, r.end]);
        expect(se).toEqual([[0, 2], [2, 8], [8, 10]]);
    });

    it('replaces smaller region when larger covering region is added', () => {
        let state = addRegion(emptyState(), { start: 5, end: 10 });
        state = addRegion(state, { start: 0, end: 20 });
        expect(state.staging[0]).toHaveLength(1);
        expect(state.staging[0][0]).toMatchObject({ start: 0, end: 20 });
    });

    it('handles partial overlap (new region extends beyond existing end)', () => {
        let state = addRegion(emptyState(), { start: 0, end: 10 });
        state = addRegion(state, { start: 5, end: 15 });
        const se = state.staging[0].map(r => [r.start, r.end]);
        expect(se).toEqual([[0, 5], [5, 15]]);
    });

    it('handles new region overlapping multiple existing regions', () => {
        let state = addRegion(emptyState(), { start: 0, end: 10 });
        state = addRegion(state, { start: 20, end: 30 });
        state = addRegion(state, { start: 5, end: 25 });
        const se = state.staging[0].map(r => [r.start, r.end]);
        expect(se).toEqual([[0, 5], [5, 25], [25, 30]]);
    });

    it('clears redoStack on add', () => {
        let state = addRegion(emptyState(), { start: 0, end: 10 });
        state = addRegion(state, { start: 20, end: 30 });
        expect(state.redoStack).toHaveLength(0);
    });
});

// ─── bounce_to_mix ────────────────────────────────────────────────────────────

describe('bounce_to_mix', () => {
    it('moves staging to mix and resets staging', () => {
        const r0 = makeRegion({ start: 0, end: 10 });
        const r1 = makeRegion({ start: 20, end: 30 });
        const state = stateWithStaging([r0, r1]);
        const next = timelineReducer(state, { type: 'bounce_to_mix' });
        expect(next.staging).toEqual([[]]);
        expect(next.mix).toHaveLength(1);
        expect(next.mix[0].map((r: Region) => [r.start, r.end])).toEqual([[0, 10], [20, 30]]);
        expect(next.undoStack).toHaveLength(0);
        expect(next.redoStack).toHaveLength(0);
    });
});

// ─── trim_region ──────────────────────────────────────────────────────────────

// MIN_REGION_SAMPLES = Math.round(0.01 * 48000) = 480 samples.
// All trim test regions must span well beyond 480 samples.
const TRIM_LEN = 10000; // >> MIN_REGION_SAMPLES

describe('trim_region', () => {
    it('trims the start of a region and updates clipOffset', () => {
        const r = makeRegion({ start: 0, end: TRIM_LEN, audioLength: TRIM_LEN });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'trim_region', id: r.id, newStart: 1000, newEnd: TRIM_LEN });
        const trimmed = next.staging[0][0];
        expect(trimmed.start).toBe(1000);
        expect(trimmed.end).toBe(TRIM_LEN);
        expect(trimmed.clipOffset).toBe(1000); // advanced by delta of 1000
    });

    it('trims the end of a region', () => {
        const r = makeRegion({ start: 0, end: TRIM_LEN, audioLength: TRIM_LEN });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'trim_region', id: r.id, newStart: 0, newEnd: TRIM_LEN - 1000 });
        const trimmed = next.staging[0][0];
        expect(trimmed.start).toBe(0);
        expect(trimmed.end).toBe(TRIM_LEN - 1000);
        expect(trimmed.clipOffset).toBe(0); // unchanged when trimming end
    });

    it('does not trim past the beginning of source audio', () => {
        // clipOffset=0 means start cannot go below region.start (minStart = start - 0 = start)
        const r = makeRegion({ start: 5000, end: 5000 + TRIM_LEN, clipOffset: 0, audioLength: TRIM_LEN });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'trim_region', id: r.id, newStart: 0, newEnd: 5000 + TRIM_LEN });
        expect(next.staging[0][0].start).toBe(5000); // clamped to minStart
    });

    it('does not trim past the end of source audio', () => {
        const r = makeRegion({ start: 0, end: TRIM_LEN, clipOffset: 0, audioLength: TRIM_LEN });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'trim_region', id: r.id, newStart: 0, newEnd: TRIM_LEN * 2 });
        expect(next.staging[0][0].end).toBe(TRIM_LEN); // clamped to maxEnd = 0 + (TRIM_LEN - 0) = TRIM_LEN
    });
});

// ─── move_region ──────────────────────────────────────────────────────────────

describe('move_region', () => {
    it('moves a region forward', () => {
        const r = makeRegion({ start: 100, end: 200 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'move_region', id: r.id, deltaSamples: 50 });
        const moved = next.staging[0][0];
        expect(moved.start).toBe(150);
        expect(moved.end).toBe(250);
    });

    it('clamps start to 0 and adjusts end accordingly', () => {
        const r = makeRegion({ start: 10, end: 110 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'move_region', id: r.id, deltaSamples: -50 });
        const moved = next.staging[0][0];
        expect(moved.start).toBe(0);
        expect(moved.end).toBe(100);
    });

    it('does not change clipOffset or latencyOffset when moving', () => {
        const r = makeRegion({ start: 100, end: 200, clipOffset: 5, latencyOffset: 20 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'move_region', id: r.id, deltaSamples: 100 });
        const moved = next.staging[0][0];
        expect(moved.clipOffset).toBe(5);
        expect(moved.latencyOffset).toBe(20);
    });
});

// ─── split_region ─────────────────────────────────────────────────────────────

// MIN_REGION_SAMPLES = Math.round(0.01 * 48000) = 480.
// Split point must leave both halves >= 480 samples.
const SPLIT_LEN = 20000;  // >> 2 * MIN_REGION_SAMPLES
const SPLIT_MID = 10000;  // splits into two 10 000-sample halves

describe('split_region', () => {
    it('splits a region at the given sample point', () => {
        const r = makeRegion({ start: 0, end: SPLIT_LEN, clipOffset: 0 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'split_region', splitPointSamples: SPLIT_MID });
        expect(next.staging[0]).toHaveLength(2);
        const [left, right] = next.staging[0];
        expect(left.start).toBe(0);
        expect(left.end).toBe(SPLIT_MID);
        expect(right.start).toBe(SPLIT_MID);
        expect(right.end).toBe(SPLIT_LEN);
    });

    it('right half has clipOffset advanced by the split distance', () => {
        // region starts at 1000, clipOffset=10; split 5000 samples in → splitPoint=6000
        const r = makeRegion({ start: 1000, end: 1000 + SPLIT_LEN, clipOffset: 10 });
        const state = stateWithStaging([r]);
        const splitPoint = 1000 + SPLIT_MID;
        const next = timelineReducer(state, { type: 'split_region', splitPointSamples: splitPoint });
        const [_left, right] = next.staging[0];
        // clipOffset = original.clipOffset + (splitPoint - region.start) = 10 + 10000 = 10010
        expect(right.clipOffset).toBe(10 + SPLIT_MID);
    });

    it('left half retains original clipOffset', () => {
        const r = makeRegion({ start: 0, end: SPLIT_LEN, clipOffset: 10 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'split_region', splitPointSamples: SPLIT_MID });
        const [left] = next.staging[0];
        expect(left.clipOffset).toBe(10);
    });

    it('does not split if either resulting part would be below MIN_REGION_SAMPLES', () => {
        const r = makeRegion({ start: 0, end: SPLIT_LEN });
        const state = stateWithStaging([r]);
        // Split at 1 sample — left part is far too small
        const next = timelineReducer(state, { type: 'split_region', splitPointSamples: 1 });
        expect(next).toBe(state);
    });

    it('preserves latencyOffset on both halves', () => {
        const r = makeRegion({ start: 0, end: SPLIT_LEN, latencyOffset: 33 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'split_region', splitPointSamples: SPLIT_MID });
        const [left, right] = next.staging[0];
        expect(left.latencyOffset).toBe(33);
        expect(right.latencyOffset).toBe(33);
    });
});

// ─── update_region_offset ────────────────────────────────────────────────────

describe('update_region_offset', () => {
    it('updates latencyOffset on the specified region', () => {
        const r = makeRegion({ start: 0, end: 100, latencyOffset: 0 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'update_region_offset', regionId: r.id, newOffset: 77 });
        expect(next.staging[0][0].latencyOffset).toBe(77);
    });

    it('returns unchanged state when region id not found', () => {
        const r = makeRegion({ start: 0, end: 100 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'update_region_offset', regionId: 'nonexistent', newOffset: 77 });
        expect(next).toBe(state);
    });
});

// ─── delete_region ────────────────────────────────────────────────────────────

describe('delete_region', () => {
    it('removes the region from staging', () => {
        const r = makeRegion({ start: 0, end: 100 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'delete_region', id: r.id });
        expect(next.staging[0]).toHaveLength(0);
    });
});

// ─── undo / redo ──────────────────────────────────────────────────────────────

describe('undo/redo', () => {
    it('undo restores previous staging', () => {
        let state = addRegion(emptyState(), { start: 0, end: 100 });
        state = addRegion(state, { start: 200, end: 300 });
        const afterUndo = timelineReducer(state, { type: 'undo' });
        expect(afterUndo.staging[0]).toHaveLength(1);
    });

    it('redo reapplies the undone change', () => {
        let state = addRegion(emptyState(), { start: 0, end: 100 });
        state = addRegion(state, { start: 200, end: 300 });
        const afterUndo = timelineReducer(state, { type: 'undo' });
        const afterRedo = timelineReducer(afterUndo, { type: 'redo' });
        expect(afterRedo.staging[0]).toHaveLength(2);
    });
});