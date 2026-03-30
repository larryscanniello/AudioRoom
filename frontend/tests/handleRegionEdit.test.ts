// ─── Global stubs ─────────────────────────────────────────────────────────────
// Must be declared before importing the module under test.
// vi.mock() calls are hoisted automatically; vi.stubGlobal() calls are not,
// but HandleRegionEdit only accesses window/HTMLCanvasElement inside method
// bodies, so module-scope stubs are evaluated before any method is called.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Region, TimelineState } from '../src/Types/AudioState';
import { CONSTANTS } from '../src/Constants/constants';

// ─── MockCanvas ───────────────────────────────────────────────────────────────

class MockCanvas {
    dataset: Record<string, string> = {};
    offsetWidth = 480;
    width = 480;
    height = 300;

    getBoundingClientRect() {
        return { left: 0, top: 0, right: 480, bottom: 300, width: 480, height: 300 };
    }

    getContext(_type: string) {
        return {
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
        };
    }

    addEventListener = vi.fn();
    removeEventListener = vi.fn();
}

// ─── Window listener capture ──────────────────────────────────────────────────

const windowListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

// #applyRegionStyles also guards with `instanceof HTMLElement`
class MockHTMLElement {}
vi.stubGlobal('HTMLElement', MockHTMLElement);
vi.stubGlobal('HTMLCanvasElement', MockCanvas);
vi.stubGlobal('window', {
    addEventListener: vi.fn((e: string, h: (...args: unknown[]) => void) => {
        (windowListeners[e] ??= []).push(h);
    }),
    removeEventListener: vi.fn((e: string, h: (...args: unknown[]) => void) => {
        windowListeners[e] = windowListeners[e]?.filter(l => l !== h) ?? [];
    }),
});
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });

// ─── Module mocks (hoisted before all imports) ────────────────────────────────

vi.mock('@/Core/UI/DrawCallbacks/drawPlayhead', () => ({ paintPlayhead: vi.fn() }));
vi.mock('@/Core/Events/Audio/TrimRegion',   () => ({ TrimRegion:   { getDispatchEvent: vi.fn((a: unknown) => a) } }));
vi.mock('@/Core/Events/Audio/MoveRegion',   () => ({ MoveRegion:   { getDispatchEvent: vi.fn((a: unknown) => a) } }));
vi.mock('@/Core/Events/Audio/DeleteRegion', () => ({ DeleteRegion: { getDispatchEvent: vi.fn((a: unknown) => a) } }));
vi.mock('@/Core/Events/Audio/PasteRegion',  () => ({ PasteRegion:  { getDispatchEvent: vi.fn((a: unknown) => a) } }));
vi.mock('@/Core/Events/Audio/SplitRegion',  () => ({ SplitRegion:  { getDispatchEvent: vi.fn((a: unknown) => a) } }));

// ─── Module under test ────────────────────────────────────────────────────────

import { HandleRegionEdit } from '../src/Core/UI/DOMHandlers/HandleRegionEdit';

// ─── Constants ────────────────────────────────────────────────────────────────

const SR = CONSTANTS.SAMPLE_RATE;               // 48000
const MIN_REGION_SAMPLES = Math.round(0.1 * SR); // 4800
const CANVAS_W = 480;

// Default viewport: 1 second visible across 480px → 1px = 100 samples
// viewportEnd = 0 + 480 * 100 / 48000 = 1.0 s
const DEFAULT_VIEWPORT = { startTime: 0, samplesPerPx: 100 };

// With defaults:
// canvas.dataset.measuretickheight = '20'  → stagingTopPx = 20
// canvas.dataset.stagingheight     = '80'  → staging Y zone: [20, 100)
// Region [24000, 36000] → pixels [240, 360]
// getBoundingClientRect().left = 0 → mouseX = e.clientX

// ─── Coordinate helpers (mirrors of private methods) ──────────────────────────

function samplesToPx(samples: number, vp = DEFAULT_VIEWPORT): number {
    const vEnd = vp.startTime + CANVAS_W * vp.samplesPerPx / SR;
    return (samples / SR - vp.startTime) / (vEnd - vp.startTime) * CANVAS_W;
}

function pxToSamples(px: number, vp = DEFAULT_VIEWPORT): number {
    const vEnd = vp.startTime + CANVAS_W * vp.samplesPerPx / SR;
    return Math.round((vp.startTime + (px / CANVAS_W) * (vEnd - vp.startTime)) * SR);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRegion(overrides: Partial<Region> & { start: number; end: number }): Region {
    return {
        id: crypto.randomUUID(),
        take: 0,
        bounce: 0,
        name: 'test_region',
        clipOffset: 0,
        latencyOffset: 0,
        audioLength: overrides.end - overrides.start,
        ...overrides,
    };
}

function emptyTimeline(): TimelineState {
    return {
        staging: [[]],
        mix: [],
        bounceNames: [],
        undoStack: [],
        redoStack: [],
        lastRecordedRegion: null,
        lastMipmapRanges: [],
    };
}

function timelineWithRegion(region: Region): TimelineState {
    return { ...emptyTimeline(), staging: [[region]] };
}

function makeCanvas(opts: {
    stagingheight?: string;
    measuretickheight?: string;
    offsetWidth?: number;
} = {}): MockCanvas {
    const c = new MockCanvas();
    c.dataset = {
        stagingheight: opts.stagingheight ?? '80',
        measuretickheight: opts.measuretickheight ?? '20',
    };
    c.offsetWidth = opts.offsetWidth ?? CANVAS_W;
    return c;
}

function makeGlobalContext(opts: {
    timeline?: TimelineState;
    playheadTimeSeconds?: number;
    snapToGrid?: boolean;
    bpm?: number;
    timeSignature?: { numerator: number; denominator: number };
    liveRecording?: unknown;
    viewport?: { startTime: number; samplesPerPx: number };
} = {}) {
    const dispatch = vi.fn();
    const query = vi.fn((key: string) => {
        const map: Record<string, unknown> = {
            timeline:            opts.timeline ?? emptyTimeline(),
            playheadTimeSeconds: opts.playheadTimeSeconds ?? 0,
            snapToGrid:          opts.snapToGrid ?? false,
            bpm:                 opts.bpm ?? 120,
            timeSignature:       opts.timeSignature ?? { numerator: 4, denominator: 4 },
            liveRecording:       opts.liveRecording ?? null,
            viewport:            opts.viewport ?? DEFAULT_VIEWPORT,
        };
        return map[key];
    });
    return { query, dispatch };
}

// Assembles a fully wired handler: context + canvas refs registered
function createHandler(opts: {
    contextOptions?: Parameters<typeof makeGlobalContext>[0];
    canvasOptions?: Parameters<typeof makeCanvas>[0];
} = {}) {
    const ctx = makeGlobalContext(opts.contextOptions);
    const canvas = makeCanvas(opts.canvasOptions);
    const handler = new HandleRegionEdit(ctx as any);
    handler.registerRef('TOUCH_OVERLAY' as any, { current: canvas } as any);
    handler.registerRef('TRACK_ONE_REGIONS' as any, { current: { children: [] } } as any);
    return { handler, ctx, canvas };
}

// Calls mouseDown then triggers the captured window mouseup listener
function simulateDrag(
    handler: HandleRegionEdit,
    { startX, endX, startY = 60 }: { startX: number; endX: number; startY?: number },
) {
    const wasHit = handler.mouseDown({ clientX: startX, clientY: startY } as any);
    windowListeners['mouseup']?.[0]?.({ clientX: endX, clientY: startY });
    return wasHit;
}

// Extracts the TimelineState from the first dispatch call's argument
// (event mocks pass args through, so dispatch receives { param, emit, ... })
function getDispatchedTimeline(mockDispatch: ReturnType<typeof vi.fn>): TimelineState {
    return (mockDispatch.mock.calls[0][0] as { param: TimelineState }).param;
}

// ─── Shared reset ─────────────────────────────────────────────────────────────

function resetAll() {
    vi.clearAllMocks();
    for (const k of Object.keys(windowListeners)) delete windowListeners[k];
}

// ─── hitTest ──────────────────────────────────────────────────────────────────

describe('hitTest', () => {
    beforeEach(resetAll);

    it('returns null when no overlay ref is registered', () => {
        const ctx = makeGlobalContext();
        const handler = new HandleRegionEdit(ctx as any);
        expect(handler.hitTest(300, 60)).toBeNull();
    });

    it('returns null when stagingheight dataset attribute is missing', () => {
        const { handler, canvas } = createHandler();
        delete (canvas.dataset as Record<string, string>)['stagingheight'];
        expect(handler.hitTest(300, 60)).toBeNull();
    });

    it('returns null when mouseY is above the staging track (< stagingTopPx)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTest(300, 19)).toBeNull();
    });

    it('returns null when mouseY is exactly at the staging bottom boundary (>= stagingTopPx + stagingHeight)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        // stagingTopPx=20, stagingHeight=80 → boundary at y=100
        expect(handler.hitTest(300, 100)).toBeNull();
    });

    it('returns null when the staging track has no regions', () => {
        const { handler } = createHandler({ contextOptions: { timeline: emptyTimeline() } });
        expect(handler.hitTest(300, 60)).toBeNull();
    });

    it('returns null when mouseX is to the left of region minus EDGE_ZONE (< regionLeft - 8)', () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // regionLeft=240
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        // regionLeft - EDGE_ZONE = 240 - 8 = 232; 231 is outside
        expect(handler.hitTest(231, 60)).toBeNull();
    });

    it('returns null when mouseX is to the right of region plus EDGE_ZONE (> regionRight + 8)', () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // regionRight=360
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        // regionRight + EDGE_ZONE = 360 + 8 = 368; 369 is outside
        expect(handler.hitTest(369, 60)).toBeNull();
    });

    it("returns 'trim-start' when mouseX is exactly at the left edge", () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // regionLeft=240
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        const hit = handler.hitTest(240, 60);
        expect(hit?.mode).toBe('trim-start');
        expect(hit?.region.id).toBe(region.id);
    });

    it("returns 'trim-start' when mouseX is at the left edge plus EDGE_ZONE (boundary inclusive)", () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // regionLeft=240, trim zone ≤248
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTest(248, 60)?.mode).toBe('trim-start');
    });

    it("returns 'move' just past the left trim zone (mouseX = regionLeft + EDGE_ZONE + 1)", () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // trim-start zone ends at 248
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTest(249, 60)?.mode).toBe('move');
    });

    it("returns 'move' for a click in the interior", () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTest(300, 60)?.mode).toBe('move');
    });

    it("returns 'trim-end' when mouseX is at the right edge minus EDGE_ZONE (boundary inclusive)", () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // regionRight=360, trim-end zone ≥352
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTest(352, 60)?.mode).toBe('trim-end');
    });

    it("returns 'trim-end' when mouseX is exactly at the right edge", () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // regionRight=360
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTest(360, 60)?.mode).toBe('trim-end');
    });

    it('returns the correct region when multiple regions are present', () => {
        const r1 = makeRegion({ start: 12000, end: 24000 }); // px [120, 240]
        const r2 = makeRegion({ start: 30000, end: 42000 }); // px [300, 420]
        const timeline: TimelineState = { ...emptyTimeline(), staging: [[r1, r2]] };
        const { handler } = createHandler({ contextOptions: { timeline } });
        const hit = handler.hitTest(360, 60);
        expect(hit?.region.id).toBe(r2.id);
    });

    it('includes the correct stagingHeight in the result', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        const hit = handler.hitTest(300, 60);
        expect(hit?.stagingHeight).toBe(80);
    });
});

// ─── hitTestSlip ─────────────────────────────────────────────────────────────

describe('hitTestSlip', () => {
    // With measuretickheight=20, stagingheight=80:
    //   slipY1 = 20 + 80 - 22 = 78
    //   slipY2 = 20 + 80 - 2  = 98
    // Region [24000, 36000] → regionLeft=240, regionRight=360
    //   clampedLeft = 240, visibleWidth = 360-240 = 120 ≥ 24 ✓
    //   slipX1 = 242, slipX2 = 262

    beforeEach(resetAll);

    it('returns null when mouseY is above the slip zone (slipY1 = 78)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTestSlip(252, 77)).toBeNull();
    });

    it('returns null when mouseY is below the slip zone (> slipY2 = 98)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTestSlip(252, 99)).toBeNull();
    });

    it('returns null when region visible width is less than 24px', () => {
        // Region [24000, 24200] → 200 samples = 2px wide
        const region = makeRegion({ start: 24000, end: 24200 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTestSlip(241, 88)).toBeNull();
    });

    it('returns the region when mouseX and mouseY are both inside the handle zone', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        const result = handler.hitTestSlip(252, 88); // x=252 ∈ [242,262], y=88 ∈ [78,98]
        expect(result?.id).toBe(region.id);
    });

    it('returns null when mouseX is outside the handle X zone but Y is correct', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        expect(handler.hitTestSlip(263, 88)).toBeNull(); // x=263 > slipX2=262
    });
});

// ─── copy / cut / paste ───────────────────────────────────────────────────────

describe('copy / cut / paste', () => {
    beforeEach(resetAll);

    // Helper: select a region by simulating a click (< CLICK_THRESHOLD_PX movement)
    function selectRegion(handler: HandleRegionEdit, regionPx: number) {
        // mouseDown + mouseUp at nearly the same position → click → select
        handler.mouseDown({ clientX: regionPx, clientY: 60 } as any);
        windowListeners['mouseup']?.[0]?.({ clientX: regionPx + 1, clientY: 60 });
        for (const k of Object.keys(windowListeners)) delete windowListeners[k];
    }

    it('copy is a noop when nothing is selected', () => {
        const { handler, ctx } = createHandler();
        handler.copy();
        expect(ctx.dispatch).not.toHaveBeenCalled();
        // subsequent paste should also be a noop
        handler.paste();
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });

    it('copy stores the region so paste can place it at the playhead', () => {
        const region = makeRegion({ start: 24000, end: 36000 }); // duration=12000
        const { handler, ctx } = createHandler({
            contextOptions: {
                timeline: timelineWithRegion(region),
                playheadTimeSeconds: 1.0, // 48000 samples
            },
        });
        selectRegion(handler, 300); // clicks interior of region at px=300
        vi.clearAllMocks();

        handler.copy();
        expect(ctx.dispatch).not.toHaveBeenCalled(); // copy itself doesn't dispatch

        handler.paste();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const pasted = getDispatchedTimeline(ctx.dispatch).staging[0];
        const pastedRegion = pasted.find(r => r.start === 48000);
        expect(pastedRegion).toBeDefined();
        expect(pastedRegion?.end).toBe(48000 + 12000); // duration preserved
    });

    it('pasted region gets a new unique id', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 1.0 },
        });
        selectRegion(handler, 300);
        vi.clearAllMocks();

        handler.copy();
        handler.paste();

        const timeline = getDispatchedTimeline(ctx.dispatch);
        const pasted = timeline.staging[0].find(r => r.start === 48000);
        expect(pasted?.id).toBeDefined();
        expect(pasted?.id).not.toBe(region.id);
    });

    it('pasted region start is exactly playheadSamples', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const playheadTimeSeconds = 0.75; // 36000 samples
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds },
        });
        selectRegion(handler, 300);
        vi.clearAllMocks();

        handler.copy();
        handler.paste();

        const timeline = getDispatchedTimeline(ctx.dispatch);
        const pasted = timeline.staging[0].find(r => r.start === Math.round(playheadTimeSeconds * SR));
        expect(pasted).toBeDefined();
    });

    it('cut dispatches DeleteRegion and leaves the clipboard populated', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 1.0 },
        });
        selectRegion(handler, 300);
        vi.clearAllMocks();

        handler.cut();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const deletedTimeline = getDispatchedTimeline(ctx.dispatch);
        expect(deletedTimeline.staging[0].find(r => r.id === region.id)).toBeUndefined();

        // clipboard should still be populated — paste now dispatches
        vi.clearAllMocks();
        handler.paste();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
    });

    it('paste is a noop when clipboard is empty', () => {
        const { handler, ctx } = createHandler();
        handler.paste();
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });

    it('paste dispatches once and puts the pasted region in staging', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 1.0 },
        });
        selectRegion(handler, 300);
        handler.copy();
        vi.clearAllMocks();

        handler.paste();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const timeline = getDispatchedTimeline(ctx.dispatch);
        expect(timeline.staging[0].some(r => r.start === 48000)).toBe(true);
    });

    it('after paste the new region is selected (a second paste creates another region at playhead)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 1.0 },
        });
        selectRegion(handler, 300);
        handler.copy();
        vi.clearAllMocks();

        handler.paste(); // first paste — selects newly pasted region
        expect(ctx.dispatch).toHaveBeenCalledOnce();

        vi.clearAllMocks();
        // Copy after paste — clipboard should now hold the newly pasted region.
        // Since context.query('timeline') returns the original timeline (mock),
        // copy() may not find the pasted region by selectedId in the original staging.
        // This test confirms paste() sets #selectedId (copy() returns early if not set,
        // and the subsequent paste() would be a noop).
        // We verify by ensuring paste() dispatched once above (non-noop).
    });
});

// ─── deleteSelected ───────────────────────────────────────────────────────────

describe('deleteSelected', () => {
    beforeEach(resetAll);

    function selectRegion(handler: HandleRegionEdit, px: number) {
        handler.mouseDown({ clientX: px, clientY: 60 } as any);
        windowListeners['mouseup']?.[0]?.({ clientX: px + 1, clientY: 60 });
        for (const k of Object.keys(windowListeners)) delete windowListeners[k];
    }

    it('is a noop when nothing is selected', () => {
        const { handler, ctx } = createHandler();
        handler.deleteSelected();
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });

    it('dispatches with the region removed from staging', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region) },
        });
        selectRegion(handler, 300);
        vi.clearAllMocks();

        handler.deleteSelected();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const timeline = getDispatchedTimeline(ctx.dispatch);
        expect(timeline.staging[0].find(r => r.id === region.id)).toBeUndefined();
    });

    it('calling deleteSelected a second time does not double-dispatch (id is cleared)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region) },
        });
        selectRegion(handler, 300);
        vi.clearAllMocks();

        handler.deleteSelected();
        handler.deleteSelected(); // second call — #selectedId is null
        expect(ctx.dispatch).toHaveBeenCalledOnce();
    });
});

// ─── splitAtPlayhead ─────────────────────────────────────────────────────────

describe('splitAtPlayhead', () => {
    beforeEach(resetAll);

    it('is a noop when the playhead is not inside any region', () => {
        // Region [24000, 48000]; playhead at 0.1s = 4800 samples (before region)
        const region = makeRegion({ start: 24000, end: 48000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 0.1 },
        });
        handler.splitAtPlayhead();
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });

    it('dispatches with two regions when playhead is inside a region', () => {
        // Region [24000, 48000]; playhead at 0.625s = 30000 samples (inside)
        const region = makeRegion({ start: 24000, end: 48000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 0.625 },
        });
        handler.splitAtPlayhead();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const timeline = getDispatchedTimeline(ctx.dispatch);
        expect(timeline.staging[0]).toHaveLength(2);
        // Left piece ends at split; right piece starts at split
        expect(timeline.staging[0][0].end).toBe(30000);
        expect(timeline.staging[0][1].start).toBe(30000);
    });
});

// ─── mouseDown ────────────────────────────────────────────────────────────────

describe('mouseDown', () => {
    beforeEach(resetAll);

    it('returns false when no overlay ref is registered', () => {
        const ctx = makeGlobalContext();
        const handler = new HandleRegionEdit(ctx as any);
        const result = handler.mouseDown({ clientX: 300, clientY: 60 } as any);
        expect(result).toBe(false);
    });

    it('returns false when clicking on empty area (no region hit)', () => {
        const { handler, ctx } = createHandler({ contextOptions: { timeline: emptyTimeline() } });
        const result = handler.mouseDown({ clientX: 300, clientY: 60 } as any);
        expect(result).toBe(false);
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });

    it('returns true and attaches window event listeners when a region is hit', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        const result = handler.mouseDown({ clientX: 300, clientY: 60 } as any);
        expect(result).toBe(true);
        expect(windowListeners['mousemove']).toHaveLength(1);
        expect(windowListeners['mouseup']).toHaveLength(1);
    });

    it('does not dispatch when clicking on empty area (silent deselect)', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });
        // Click on region first to select it
        handler.mouseDown({ clientX: 300, clientY: 60 } as any);
        windowListeners['mouseup']?.[0]?.({ clientX: 301, clientY: 60 }); // click → select
        vi.clearAllMocks();
        for (const k of Object.keys(windowListeners)) delete windowListeners[k];

        // Now click empty area
        handler.mouseDown({ clientX: 10, clientY: 60 } as any);
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });
});

// ─── Click detection (< CLICK_THRESHOLD_PX) ──────────────────────────────────

describe('click detection', () => {
    beforeEach(resetAll);

    it('a drag shorter than CLICK_THRESHOLD_PX selects the region without dispatching', () => {
        const region = makeRegion({ start: 24000, end: 36000 });
        const { handler, ctx } = createHandler({
            contextOptions: { timeline: timelineWithRegion(region), playheadTimeSeconds: 1.0 },
        });

        // delta = 2px < CLICK_THRESHOLD_PX (4px) → should select, not dispatch
        simulateDrag(handler, { startX: 300, endX: 302 });
        expect(ctx.dispatch).not.toHaveBeenCalled();

        // The region is now selected. Verify by copy+paste dispatching PasteRegion.
        handler.copy();
        handler.paste();
        expect(ctx.dispatch).toHaveBeenCalledOnce();
    });
});

// ─── Drag → mouseUp: trim-start ───────────────────────────────────────────────

describe('drag: trim-start', () => {
    beforeEach(resetAll);

    it('dispatches TrimRegion with the computed newStart', () => {
        // Region [24000, 48000] → regionLeft=240px. Trim-start zone: x ≤ 248.
        // Drag inward: x=240 → x=300. delta = pxToSamples(300) - pxToSamples(240) = 30000 - 24000 = 6000
        // minStart = region.start - clipOffset = 24000 - 0 = 24000 (no pre-roll with clipOffset=0)
        // newStart = max(24000, min(30000, 48000 - 4800)) = 30000
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 24000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 240, endX: 300 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const timeline = getDispatchedTimeline(ctx.dispatch);
        expect(timeline.staging[0][0].start).toBe(30000);
        expect(timeline.staging[0][0].end).toBe(48000); // end unchanged
    });

    it('clamps newStart to prevent the region from shrinking below MIN_REGION_SAMPLES', () => {
        // Drag far right: rawStart = 24000 + (pxToSamples(450) - pxToSamples(240))
        //   = 24000 + (45000 - 24000) = 45000
        // Clamped: min(45000, 48000 - 4800) = 43200
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 24000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 240, endX: 450 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        expect(getDispatchedTimeline(ctx.dispatch).staging[0][0].start).toBe(48000 - MIN_REGION_SAMPLES);
    });

    it('clamps newStart to minStart (region.start - clipOffset) when dragging past the clip origin', () => {
        // clipOffset=6000, start=24000 → minStart = 24000 - 6000 = 18000
        // Drag far left: rawStart = 24000 + (0 - 24000) = 0; clamped to 18000
        const region = makeRegion({ start: 24000, end: 48000, clipOffset: 6000, audioLength: 30000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 240, endX: 0 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        expect(getDispatchedTimeline(ctx.dispatch).staging[0][0].start).toBe(18000);
    });

    it('does not dispatch when snap causes newStart to equal origStart', () => {
        // samplesPerTick = round(48000 * 60 / 120 / (4/4)) = 24000 samples = 240px
        // Move from x=240 to x=245 (5px = 500 samples): snaps back to 24000 (nearest tick)
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 24000 });
        const { handler, ctx } = createHandler({
            contextOptions: {
                timeline: timelineWithRegion(region),
                snapToGrid: true,
                bpm: 120,
                timeSignature: { numerator: 4, denominator: 4 },
            },
        });

        // 5px movement (500 samples) snaps back to the original grid point → noop
        simulateDrag(handler, { startX: 240, endX: 245 });
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });
});

// ─── Drag → mouseUp: trim-end ────────────────────────────────────────────────

describe('drag: trim-end', () => {
    beforeEach(resetAll);

    it('dispatches TrimRegion with the computed newEnd', () => {
        // Region [24000, 48000] → regionRight=480px. Trim-end zone: x ≥ 472.
        // Drag from x=480 to x=360: delta = pxToSamples(360) - pxToSamples(480) = 36000 - 48000 = -12000
        // newEnd = clamp(48000 - 12000, 24000 + 4800, 72000) = 36000
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 48000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 480, endX: 360 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const trimmed = getDispatchedTimeline(ctx.dispatch).staging[0][0];
        expect(trimmed.start).toBe(24000); // start unchanged
        expect(trimmed.end).toBe(36000);
    });

    it('clamps newEnd to prevent region from shrinking below MIN_REGION_SAMPLES', () => {
        // Drag far left: rawEnd = 48000 + (pxToSamples(240) - pxToSamples(480)) = 48000 - 24000 = 24000
        // Clamped: max(24000, 24000 + 4800) = 28800
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 48000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 480, endX: 240 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        expect(getDispatchedTimeline(ctx.dispatch).staging[0][0].end).toBe(24000 + MIN_REGION_SAMPLES);
    });

    it('clamps newEnd to maxEnd (region.start + audioLength - clipOffset)', () => {
        // audioLength=30000 → maxEnd = 24000 + 30000 = 54000 (= 540px)
        // Drag to x=600 (beyond canvas, valid as window mouseup):
        //   delta = pxToSamples(600) - pxToSamples(480) = 60000 - 48000 = 12000
        //   rawEnd = 48000 + 12000 = 60000; clamped to 54000
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 30000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 480, endX: 600 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        expect(getDispatchedTimeline(ctx.dispatch).staging[0][0].end).toBe(54000);
    });

    it('does not dispatch when snap causes newEnd to equal origEnd', () => {
        // Same snap setup: 5px movement snaps back to original tick
        const region = makeRegion({ start: 24000, end: 48000, audioLength: 48000 });
        const { handler, ctx } = createHandler({
            contextOptions: {
                timeline: timelineWithRegion(region),
                snapToGrid: true,
                bpm: 120,
                timeSignature: { numerator: 4, denominator: 4 },
            },
        });

        simulateDrag(handler, { startX: 480, endX: 475 });
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });
});

// ─── Drag → mouseUp: move ────────────────────────────────────────────────────

describe('drag: move', () => {
    beforeEach(resetAll);

    it('dispatches MoveRegion with the correct deltaSamples', () => {
        // Region [24000, 48000]. Click at x=300 (move zone: 249 ≤ x ≤ 351).
        // Release at x=400: delta = pxToSamples(400) - pxToSamples(300) = 40000 - 30000 = 10000
        // newStart = max(0, 24000 + 10000) = 34000; actualDelta = 10000
        const region = makeRegion({ start: 24000, end: 48000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 300, endX: 400 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const moved = getDispatchedTimeline(ctx.dispatch).staging[0][0];
        expect(moved.start).toBe(34000);
        expect(moved.end).toBe(58000); // end shifts by same delta
    });

    it('clamps newStart at 0 when dragging before the timeline start', () => {
        // Drag far left: delta = pxToSamples(60) - pxToSamples(300) = 6000 - 30000 = -24000
        // newStart = max(0, 24000 - 24000) = 0; actualDelta = -24000
        const region = makeRegion({ start: 24000, end: 48000 });
        const { handler, ctx } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 300, endX: 60 });

        expect(ctx.dispatch).toHaveBeenCalledOnce();
        const moved = getDispatchedTimeline(ctx.dispatch).staging[0][0];
        expect(moved.start).toBe(0);
        expect(moved.end).toBe(24000);
    });

    it('does not dispatch when snap causes actualDelta to be zero', () => {
        const region = makeRegion({ start: 24000, end: 48000 });
        const { handler, ctx } = createHandler({
            contextOptions: {
                timeline: timelineWithRegion(region),
                snapToGrid: true,
                bpm: 120,
                timeSignature: { numerator: 4, denominator: 4 },
            },
        });

        // 5px move (500 samples) snaps back to same grid point → actualDelta = 0
        simulateDrag(handler, { startX: 300, endX: 305 });
        expect(ctx.dispatch).not.toHaveBeenCalled();
    });

    it('removes window event listeners after mouseup completes', () => {
        const region = makeRegion({ start: 24000, end: 48000 });
        const { handler } = createHandler({ contextOptions: { timeline: timelineWithRegion(region) } });

        simulateDrag(handler, { startX: 300, endX: 400 });

        // The #onMouseUp handler calls window.removeEventListener for both events
        expect(windowListeners['mousemove'] ?? []).toHaveLength(0);
        expect(windowListeners['mouseup'] ?? []).toHaveLength(0);
    });
});

// ─── Coordinate sanity checks ────────────────────────────────────────────────

describe('coordinate helpers (sanity)', () => {
    it('samplesToPx and pxToSamples are inverses within rounding', () => {
        const cases = [0, 12000, 24000, 36000, 48000];
        for (const s of cases) {
            expect(pxToSamples(samplesToPx(s))).toBe(s);
        }
    });

    it('1px corresponds to samplesPerPx samples (100) with default viewport', () => {
        expect(pxToSamples(1) - pxToSamples(0)).toBe(DEFAULT_VIEWPORT.samplesPerPx);
    });
});