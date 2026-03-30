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
        bounceNames: [],
    };
}

function stateWithStaging(regions: Region[]): TimelineState {
    return { ...emptyState(), staging: [regions] };
}

function stateWithMix(bounces: Region[][], names?: string[]): TimelineState {
    return {
        ...emptyState(),
        mix: bounces,
        bounceNames: names ?? bounces.map((_, i) => `Bounce ${i + 1}`),
    };
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

    it('sets lastRecordedRegion to the new region', () => {
        const state = addRegion(emptyState(), { start: 0, end: 100 });
        expect(state.lastRecordedRegion).toMatchObject({ start: 0, end: 100 });
    });

    it('sets lastMipmapRanges to the new region bounds', () => {
        const state = addRegion(emptyState(), { start: 50, end: 200 });
        expect(state.lastMipmapRanges).toEqual([{ start: 50, end: 200 }]);
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

    it('stores custom name in bounceNames', () => {
        const state = stateWithStaging([makeRegion({ start: 0, end: 10 })]);
        const next = timelineReducer(state, { type: 'bounce_to_mix', name: 'Verse 1' });
        expect(next.bounceNames).toEqual(['Verse 1']);
    });

    it('defaults bounce name to "Bounce N" when no name given', () => {
        const r = makeRegion({ start: 0, end: 10 });
        // Start with 1 existing bounce so the next should be "Bounce 2"
        const state: TimelineState = { ...stateWithStaging([r]), mix: [[r]], bounceNames: ['Bounce 1'] };
        const next = timelineReducer(state, { type: 'bounce_to_mix' });
        expect(next.bounceNames![1]).toBe('Bounce 2');
    });

    it('accumulates multiple bounces in mix', () => {
        let state = stateWithStaging([makeRegion({ start: 0, end: 10 })]);
        state = timelineReducer(state, { type: 'bounce_to_mix', name: 'A' });
        state = timelineReducer({ ...state, staging: [[makeRegion({ start: 20, end: 30 })]] }, { type: 'bounce_to_mix', name: 'B' });
        expect(state.mix).toHaveLength(2);
        expect(state.bounceNames).toEqual(['A', 'B']);
    });

    it('clears undo and redo stacks', () => {
        let state = addRegion(emptyState(), { start: 0, end: 100 });
        expect(state.undoStack.length).toBeGreaterThan(0);
        state = timelineReducer(state, { type: 'bounce_to_mix' });
        expect(state.undoStack).toHaveLength(0);
        expect(state.redoStack).toHaveLength(0);
    });

    it('empty staging still creates a mix entry', () => {
        const next = timelineReducer(emptyState(), { type: 'bounce_to_mix' });
        expect(next.mix).toHaveLength(1);
        expect(next.mix[0]).toHaveLength(0);
    });
});

// ─── delete_mix_bounces ───────────────────────────────────────────────────────

describe('delete_mix_bounces', () => {
    it('deletes a single bounce at a valid index', () => {
        const r = makeRegion({ start: 0, end: 10 });
        const state = stateWithMix([[r], [makeRegion({ start: 20, end: 30 })]]);
        const next = timelineReducer(state, { type: 'delete_mix_bounces', bounceIndices: [0] });
        expect(next.mix).toHaveLength(1);
        expect(next.mix[0][0]).toMatchObject({ start: 20, end: 30 });
    });

    it('deletes multiple non-contiguous bounces in one action', () => {
        const state = stateWithMix([
            [makeRegion({ start: 0, end: 10 })],
            [makeRegion({ start: 20, end: 30 })],
            [makeRegion({ start: 40, end: 50 })],
        ], ['A', 'B', 'C']);
        const next = timelineReducer(state, { type: 'delete_mix_bounces', bounceIndices: [0, 2] });
        expect(next.mix).toHaveLength(1);
        expect(next.bounceNames).toEqual(['B']);
    });

    it('keeps bounceNames in sync after deletion', () => {
        const state = stateWithMix(
            [[makeRegion({ start: 0, end: 10 })], [makeRegion({ start: 20, end: 30 })]],
            ['Keep Me', 'Delete Me']
        );
        const next = timelineReducer(state, { type: 'delete_mix_bounces', bounceIndices: [1] });
        expect(next.bounceNames).toEqual(['Keep Me']);
    });

    it('clears undo and redo stacks', () => {
        let state = addRegion(emptyState(), { start: 0, end: 100 });
        state = timelineReducer(state, { type: 'bounce_to_mix' });
        // Add something to undo stack
        state = { ...state, undoStack: [{ staging: [[]], mix: [], mipmapRanges: [] }] };
        const next = timelineReducer(state, { type: 'delete_mix_bounces', bounceIndices: [0] });
        expect(next.undoStack).toHaveLength(0);
        expect(next.redoStack).toHaveLength(0);
    });

    it('out-of-range index is silently ignored', () => {
        const state = stateWithMix([[makeRegion({ start: 0, end: 10 })]]);
        const next = timelineReducer(state, { type: 'delete_mix_bounces', bounceIndices: [99] });
        expect(next.mix).toHaveLength(1);
    });
});

// ─── delete_staging_regions ───────────────────────────────────────────────────

describe('delete_staging_regions', () => {
    it('clears staging to [[]]', () => {
        const state = stateWithStaging([makeRegion({ start: 0, end: 100 })]);
        const next = timelineReducer(state, { type: 'delete_staging_regions' });
        expect(next.staging).toEqual([[]]);
    });

    it('pushes undo so staging can be restored', () => {
        const r = makeRegion({ start: 0, end: 100 });
        const state = stateWithStaging([r]);
        const afterDelete = timelineReducer(state, { type: 'delete_staging_regions' });
        expect(afterDelete.undoStack.length).toBeGreaterThan(0);
        const afterUndo = timelineReducer(afterDelete, { type: 'undo' });
        expect(afterUndo.staging[0]).toHaveLength(1);
    });

    it('clears redo stack', () => {
        const state: TimelineState = {
            ...stateWithStaging([makeRegion({ start: 0, end: 100 })]),
            redoStack: [{ staging: [[]], mix: [], mipmapRanges: [] }],
        };
        const next = timelineReducer(state, { type: 'delete_staging_regions' });
        expect(next.redoStack).toHaveLength(0);
    });

    it('lastMipmapRanges covers the full extent of deleted staging', () => {
        const state = stateWithStaging([
            makeRegion({ start: 100, end: 500 }),
            makeRegion({ start: 600, end: 1000 }),
        ]);
        const next = timelineReducer(state, { type: 'delete_staging_regions' });
        expect(next.lastMipmapRanges).toEqual([{ start: 100, end: 1000 }]);
    });

    it('lastMipmapRanges is [] when staging is already empty', () => {
        const next = timelineReducer(emptyState(), { type: 'delete_staging_regions' });
        expect(next.lastMipmapRanges).toEqual([]);
    });
});

// ─── delete_mix_regions ───────────────────────────────────────────────────────

describe('delete_mix_regions', () => {
    it('clears entire mix to []', () => {
        const state = stateWithMix([[makeRegion({ start: 0, end: 10 })]]);
        const next = timelineReducer(state, { type: 'delete_mix_regions' });
        expect(next.mix).toEqual([]);
    });

    it('clears bounceNames to []', () => {
        const state = stateWithMix([[makeRegion({ start: 0, end: 10 })]], ['My Bounce']);
        const next = timelineReducer(state, { type: 'delete_mix_regions' });
        expect(next.bounceNames).toEqual([]);
    });

    it('pushes undo; undo restores mix', () => {
        const r = makeRegion({ start: 0, end: 10 });
        const state = stateWithMix([[r]]);
        const afterDelete = timelineReducer(state, { type: 'delete_mix_regions' });
        expect(afterDelete.undoStack.length).toBeGreaterThan(0);
        const afterUndo = timelineReducer(afterDelete, { type: 'undo' });
        expect(afterUndo.mix).toHaveLength(1);
    });
});

// ─── restage_from_mix ────────────────────────────────────────────────────────

describe('restage_from_mix', () => {
    it('moves the specified bounce into staging', () => {
        const r = makeRegion({ start: 0, end: 10 });
        const state = stateWithMix([[r]]);
        const next = timelineReducer(state, { type: 'restage_from_mix', bounceIndex: 0 });
        expect(next.staging[0]).toHaveLength(1);
        expect(next.staging[0][0]).toMatchObject({ start: 0, end: 10 });
    });

    it('removes the bounce from mix', () => {
        const state = stateWithMix([
            [makeRegion({ start: 0, end: 10 })],
            [makeRegion({ start: 20, end: 30 })],
        ]);
        const next = timelineReducer(state, { type: 'restage_from_mix', bounceIndex: 0 });
        expect(next.mix).toHaveLength(1);
        expect(next.mix[0][0]).toMatchObject({ start: 20, end: 30 });
    });

    it('removes the corresponding bounceNames entry', () => {
        const state = stateWithMix(
            [[makeRegion({ start: 0, end: 10 })], [makeRegion({ start: 20, end: 30 })]],
            ['Keep', 'Restage Me']
        );
        const next = timelineReducer(state, { type: 'restage_from_mix', bounceIndex: 1 });
        expect(next.bounceNames).toEqual(['Keep']);
    });

    it('clears undo and redo stacks', () => {
        const state: TimelineState = {
            ...stateWithMix([[makeRegion({ start: 0, end: 10 })]]),
            undoStack: [{ staging: [[]], mix: [], mipmapRanges: [] }],
            redoStack: [{ staging: [[]], mix: [], mipmapRanges: [] }],
        };
        const next = timelineReducer(state, { type: 'restage_from_mix', bounceIndex: 0 });
        expect(next.undoStack).toHaveLength(0);
        expect(next.redoStack).toHaveLength(0);
    });

    it('out-of-bounds index produces empty staging', () => {
        const state = stateWithMix([[makeRegion({ start: 0, end: 10 })]]);
        const next = timelineReducer(state, { type: 'restage_from_mix', bounceIndex: 99 });
        expect(next.staging[0]).toHaveLength(0);
    });
});

// ─── paste_region ────────────────────────────────────────────────────────────

describe('paste_region', () => {
    it('pastes a region onto empty staging', () => {
        const r = makeRegion({ start: 100, end: 200 });
        const next = timelineReducer(emptyState(), { type: 'paste_region', region: r });
        expect(next.staging[0]).toHaveLength(1);
        expect(next.staging[0][0]).toMatchObject({ start: 100, end: 200 });
    });

    it('clips existing region when pasted region overlaps', () => {
        const existing = makeRegion({ start: 0, end: 300 });
        const state = stateWithStaging([existing]);
        const pasted = makeRegion({ start: 100, end: 200 });
        const next = timelineReducer(state, { type: 'paste_region', region: pasted });
        const bounds = next.staging[0].map((r: Region) => [r.start, r.end]);
        expect(bounds).toEqual([[0, 100], [100, 200], [200, 300]]);
    });

    it('pushes undo and clears redo', () => {
        const state: TimelineState = {
            ...emptyState(),
            redoStack: [{ staging: [[]], mix: [], mipmapRanges: [] }],
        };
        const r = makeRegion({ start: 0, end: 100 });
        const next = timelineReducer(state, { type: 'paste_region', region: r });
        expect(next.undoStack.length).toBeGreaterThan(0);
        expect(next.redoStack).toHaveLength(0);
    });

    it('lastMipmapRanges matches pasted region bounds', () => {
        const r = makeRegion({ start: 50, end: 150 });
        const next = timelineReducer(emptyState(), { type: 'paste_region', region: r });
        expect(next.lastMipmapRanges).toEqual([{ start: 50, end: 150 }]);
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

    it('returns same state reference when region id not found', () => {
        const state = stateWithStaging([makeRegion({ start: 0, end: TRIM_LEN })]);
        const next = timelineReducer(state, { type: 'trim_region', id: 'nonexistent', newStart: 0, newEnd: TRIM_LEN });
        expect(next).toBe(state);
    });

    it('accumulates clipOffset on a second trim', () => {
        const r = makeRegion({ start: 0, end: TRIM_LEN, audioLength: TRIM_LEN });
        const state = stateWithStaging([r]);
        // First trim: advance start by 1000 → clipOffset becomes 1000
        const s1 = timelineReducer(state, { type: 'trim_region', id: r.id, newStart: 1000, newEnd: TRIM_LEN });
        const r1 = s1.staging[0][0];
        expect(r1.clipOffset).toBe(1000);
        // Second trim: advance start another 500 → clipOffset becomes 1500
        const s2 = timelineReducer(s1, { type: 'trim_region', id: r1.id, newStart: 1500, newEnd: TRIM_LEN });
        expect(s2.staging[0][0].clipOffset).toBe(1500);
    });

    it('lastMipmapRanges spans the union of old and new region bounds', () => {
        const r = makeRegion({ start: 1000, end: 5000, audioLength: 4000 });
        const state = stateWithStaging([r]);
        // Trim start back to 0 (expand region leftward)
        const next = timelineReducer(state, { type: 'trim_region', id: r.id, newStart: 1000, newEnd: 8000 });
        // union: min(old.start=1000, new.start=1000)=1000, max(old.end=5000, new.end=clamped to audioLength=5000)
        expect(next.lastMipmapRanges[0].start).toBeLessThanOrEqual(1000);
        expect(next.lastMipmapRanges[0].end).toBeGreaterThanOrEqual(5000);
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

    it('returns same state reference when region id not found', () => {
        const state = stateWithStaging([makeRegion({ start: 100, end: 200 })]);
        const next = timelineReducer(state, { type: 'move_region', id: 'nonexistent', deltaSamples: 50 });
        expect(next).toBe(state);
    });

    it('clips existing region when moved region overlaps it', () => {
        const r1 = makeRegion({ start: 0, end: 1000 });
        const r2 = makeRegion({ start: 2000, end: 3000 });
        const state = stateWithStaging([r1, r2]);
        // Move r2 leftward to overlap r1
        const next = timelineReducer(state, { type: 'move_region', id: r2.id, deltaSamples: -1500 });
        const bounds = next.staging[0].map((r: Region) => [r.start, r.end]);
        // r2 moved to [500, 1500]; r1 should be clipped to [0, 500]
        expect(bounds).toEqual([[0, 500], [500, 1500]]);
    });

    it('lastMipmapRanges spans the union of original and moved bounds', () => {
        const r = makeRegion({ start: 1000, end: 2000 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'move_region', id: r.id, deltaSamples: 500 });
        expect(next.lastMipmapRanges).toEqual([{ start: 1000, end: 2500 }]);
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

    it('returns same state when split point is outside all regions', () => {
        const r = makeRegion({ start: 0, end: SPLIT_LEN });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'split_region', splitPointSamples: SPLIT_LEN + 1000 });
        expect(next).toBe(state);
    });

    it('returns same state when split point is exactly at a region boundary', () => {
        const r = makeRegion({ start: 0, end: SPLIT_LEN });
        const state = stateWithStaging([r]);
        // At start: r.start < splitPoint is false
        const atStart = timelineReducer(state, { type: 'split_region', splitPointSamples: 0 });
        expect(atStart).toBe(state);
        // At end: r.end > splitPoint is false
        const atEnd = timelineReducer(state, { type: 'split_region', splitPointSamples: SPLIT_LEN });
        expect(atEnd).toBe(state);
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

    it('returns same state reference when region id not found', () => {
        const r = makeRegion({ start: 0, end: 100 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'delete_region', id: 'nonexistent' });
        expect(next).toBe(state);
    });

    it('removes only the correct region when multiple are present', () => {
        const r1 = makeRegion({ start: 0, end: 100 });
        const r2 = makeRegion({ start: 200, end: 300 });
        const state = stateWithStaging([r1, r2]);
        const next = timelineReducer(state, { type: 'delete_region', id: r1.id });
        expect(next.staging[0]).toHaveLength(1);
        expect(next.staging[0][0].id).toBe(r2.id);
    });

    it('lastMipmapRanges matches the deleted region bounds', () => {
        const r = makeRegion({ start: 300, end: 700 });
        const state = stateWithStaging([r]);
        const next = timelineReducer(state, { type: 'delete_region', id: r.id });
        expect(next.lastMipmapRanges).toEqual([{ start: 300, end: 700 }]);
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

    it('undo on empty stack returns same state reference', () => {
        const state = emptyState();
        const next = timelineReducer(state, { type: 'undo' });
        expect(next).toBe(state);
    });

    it('redo on empty stack returns same state reference', () => {
        const state = emptyState();
        const next = timelineReducer(state, { type: 'redo' });
        expect(next).toBe(state);
    });

    it('full undo/redo chain restores correct staging at each step', () => {
        let state = addRegion(emptyState(), { start: 0, end: 100 });     // 1 region
        state     = addRegion(state, { start: 200, end: 300 });          // 2 regions
        state     = timelineReducer(state, { type: 'undo' });            // back to 1
        expect(state.staging[0]).toHaveLength(1);
        state     = timelineReducer(state, { type: 'undo' });            // back to 0
        expect(state.staging[0]).toHaveLength(0);
        state     = timelineReducer(state, { type: 'redo' });            // 1 region
        expect(state.staging[0]).toHaveLength(1);
        state     = timelineReducer(state, { type: 'redo' });            // 2 regions
        expect(state.staging[0]).toHaveLength(2);
    });

    it('mutation after undo clears redo stack', () => {
        let state = addRegion(emptyState(), { start: 0, end: 100 });
        state     = addRegion(state, { start: 200, end: 300 });
        state     = timelineReducer(state, { type: 'undo' });
        expect(state.redoStack.length).toBeGreaterThan(0);
        state     = addRegion(state, { start: 400, end: 500 });          // new mutation
        expect(state.redoStack).toHaveLength(0);
    });

    it('MAX_UNDO_DEPTH: undo stack never exceeds 20 entries', () => {
        let state = emptyState();
        for (let i = 0; i < 21; i++) {
            // Each add uses a non-overlapping window
            state = addRegion(state, { start: i * 1000, end: i * 1000 + 100 });
        }
        expect(state.undoStack.length).toBe(20);
    });

    it('undo of a staging edit preserves mix', () => {
        const mixRegion = makeRegion({ start: 0, end: 10 });
        let state: TimelineState = { ...emptyState(), mix: [[mixRegion]], bounceNames: ['B1'] };
        state = addRegion(state, { start: 100, end: 200 });
        const afterUndo = timelineReducer(state, { type: 'undo' });
        expect(afterUndo.mix).toHaveLength(1);
        expect(afterUndo.mix[0][0]).toMatchObject({ start: 0, end: 10 });
    });
});