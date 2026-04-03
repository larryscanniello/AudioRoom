import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayheadManager } from '../src/Core/UI/PlayheadManager';
import { UIEngine } from '../src/Core/UI/UIEngine';
import { DOMElements } from '../src/Constants/DOMElements';

// ─── Mocks ────────────────────────────────────────────────────────────────────

function makeAudioCtx(currentTime = 0) {
    return { currentTime } as AudioContext;
}

function makeContext(overrides: { isPlaying?: boolean; isRecording?: boolean; isLooping?: boolean } = {}) {
    const dispatched: any[] = [];
    return {
        query: vi.fn((key: string) => {
            if (key === 'isPlaying') return overrides.isPlaying ?? true;
            if (key === 'isRecording') return overrides.isRecording ?? false;
            if (key === 'isLooping') return overrides.isLooping ?? false;
            return null;
        }),
        dispatch: vi.fn((event: any) => { dispatched.push(event); }),
        _dispatched: dispatched,
    } as any;
}

function makeRef(current: HTMLElement | null = {} as HTMLElement) {
    return { current } as React.RefObject<HTMLElement | null>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlayheadManager', () => {
    let rAFCallbacks: FrameRequestCallback[];

    beforeEach(() => {
        rAFCallbacks = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rAFCallbacks.push(cb);
            return rAFCallbacks.length;
        });
    });

    function flushFrames(n = 1) {
        for (let i = 0; i < n; i++) {
            const cbs = [...rAFCallbacks];
            rAFCallbacks.length = 0;
            cbs.forEach(cb => cb(0));
        }
    }

    describe('with valid refs', () => {
        it('dispatches PlayheadMoveAuto on each frame while isMoving', () => {
            const audioCtx = makeAudioCtx(1.0);
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            const playheadRef = makeRef();
            const waveformRef = makeRef();
            pm.playheadLoop(playheadRef, waveformRef, { start: 0, end: 10 });

            expect(ctx.dispatch).toHaveBeenCalledTimes(1);
            flushFrames(2);
            expect(ctx.dispatch).toHaveBeenCalledTimes(3); // initial + 2 frames
        });

        it('stops scheduling rAF after stop() is called', () => {
            const audioCtx = makeAudioCtx(0);
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            pm.playheadLoop(makeRef(), makeRef(), { start: 0, end: 10 });
            flushFrames(1);
            pm.stop();
            const dispatchCountBeforeStop = ctx.dispatch.mock.calls.length;
            // One already-queued rAF frame still fires; beyond that, no more.
            flushFrames(3);
            expect(ctx.dispatch.mock.calls.length).toBe(dispatchCountBeforeStop + 1);
        });
    });

    describe('with null refs (mixer view open)', () => {
        it('still reschedules rAF when refs are null', () => {
            const audioCtx = makeAudioCtx(1.0);
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            pm.playheadLoop(makeRef(null), makeRef(null), { start: 0, end: 10 });

            expect(rAFCallbacks.length).toBe(1);
        });

        it('continues rescheduling across multiple frames when refs are null', () => {
            const audioCtx = makeAudioCtx(1.0);
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            pm.playheadLoop(makeRef(null), makeRef(null), { start: 0, end: 10 });
            flushFrames(3);

            // Should have rescheduled 3 more times
            expect(rAFCallbacks.length).toBe(1);
        });

        it('dispatches PlayheadMoveAuto even when refs are null', () => {
            const audioCtx = makeAudioCtx(2.0);
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            pm.playheadLoop(makeRef(null), makeRef(null), { start: 0, end: 10 });

            expect(ctx.dispatch).toHaveBeenCalledTimes(1);
        });

        it('tracks playhead time correctly while refs are null', () => {
            let time = 0;
            const audioCtx = { get currentTime() { return time; } } as AudioContext;
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            time = 3.0;
            pm.playheadLoop(makeRef(null), makeRef(null), { start: 0, end: 10 });

            const dispatchedEvent = ctx.dispatch.mock.calls[0][0];
            // The event's transactionData mutation should have value = 3.0
            expect(dispatchedEvent.transactionData.mutations[0].value).toBeCloseTo(3.0);
        });

        it('stops rAF after stop() even when refs are null', () => {
            const audioCtx = makeAudioCtx(0);
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            pm.playheadLoop(makeRef(null), makeRef(null), { start: 0, end: 10 });
            pm.stop();
            flushFrames(1); // flush the one scheduled frame

            // After that frame, isMoving = false so no more should be scheduled
            expect(rAFCallbacks.length).toBe(0);
        });

        it('resumes normal dispatch when refs become non-null (mixer closes)', () => {
            let time = 0;
            const audioCtx = { get currentTime() { return time; } } as AudioContext;
            const ctx = makeContext({ isPlaying: true });
            const pm = new PlayheadManager(ctx, audioCtx);
            pm.playheadData = { isMoving: true, startTime: 0 };

            const playheadRef = makeRef(null);
            const waveformRef = makeRef(null);

            // Two frames with null refs
            time = 1;
            pm.playheadLoop(playheadRef, waveformRef, { start: 0, end: 10 });
            time = 2;
            flushFrames(1);

            // Simulate mixer closing — refs get real elements
            (playheadRef as any).current = {} as HTMLElement;
            (waveformRef as any).current = {} as HTMLElement;

            time = 3;
            flushFrames(1);

            // All three frames (initial + 2 flushes) should have dispatched
            expect(ctx.dispatch).toHaveBeenCalledTimes(3);
        });
    });
});

// ─── UIEngine.startPlayhead regression tests ──────────────────────────────────
// These guard against the bug where startPlayhead() returned early when canvas
// refs were null (i.e. the mixer was open and DAW canvases were unmounted),
// preventing the playhead loop from ever being scheduled.

function makeWorker() {
    return { onmessage: null, postMessage: vi.fn() } as unknown as Worker;
}

function makeMipMap() {
    return {
        staging: new Int8Array(0),
        mix: new Int8Array(0),
        empty: new Int8Array(0),
    };
}

function makeMediaProvider(audioCtx: AudioContext) {
    return { getAudioContext: () => audioCtx } as any;
}

function makeUIEngine(ctx = makeContext(), audioCtx = makeAudioCtx()) {
    const hardware = { opfsWorker: makeWorker(), mipMap: makeMipMap() };
    return new UIEngine(hardware, makeMediaProvider(audioCtx), ctx);
}

describe('UIEngine.startPlayhead', () => {
    let rAFCallbacks: FrameRequestCallback[];

    beforeEach(() => {
        rAFCallbacks = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rAFCallbacks.push(cb);
            return rAFCallbacks.length;
        });
    });

    function flushFrames(n = 1) {
        for (let i = 0; i < n; i++) {
            const cbs = [...rAFCallbacks];
            rAFCallbacks.length = 0;
            cbs.forEach(cb => cb(0));
        }
    }

    it('schedules rAF when no refs are registered (first call before DAW mounts)', () => {
        const engine = makeUIEngine(makeContext({ isPlaying: true }));
        engine.startPlayhead({ start: 0, end: 10 });
        expect(rAFCallbacks.length).toBe(1);
    });

    it('schedules rAF when refs are registered but .current is null (mixer open)', () => {
        const engine = makeUIEngine(makeContext({ isPlaying: true }));
        engine.registerRef(DOMElements.TOUCH_OVERLAY, makeRef(null));
        engine.registerRef(DOMElements.TRACK_ONE, makeRef(null));

        engine.startPlayhead({ start: 0, end: 10 });

        expect(rAFCallbacks.length).toBe(1);
    });

    it('schedules rAF when refs are valid (normal case)', () => {
        const engine = makeUIEngine(makeContext({ isPlaying: true }));
        engine.registerRef(DOMElements.TOUCH_OVERLAY, makeRef());
        engine.registerRef(DOMElements.TRACK_ONE, makeRef());

        engine.startPlayhead({ start: 0, end: 10 });

        expect(rAFCallbacks.length).toBe(1);
    });

    it('dispatches PlayheadMoveAuto on first frame when refs are null (mixer open)', () => {
        const ctx = makeContext({ isPlaying: true });
        const engine = makeUIEngine(ctx, makeAudioCtx(5.0));
        engine.registerRef(DOMElements.TOUCH_OVERLAY, makeRef(null));
        engine.registerRef(DOMElements.TRACK_ONE, makeRef(null));

        engine.startPlayhead({ start: 0, end: 10 });

        expect(ctx.dispatch).toHaveBeenCalledTimes(1);
    });

    it('keeps rescheduling rAF across frames while refs are null (mixer stays open)', () => {
        const engine = makeUIEngine(makeContext({ isPlaying: true }));
        engine.registerRef(DOMElements.TOUCH_OVERLAY, makeRef(null));
        engine.registerRef(DOMElements.TRACK_ONE, makeRef(null));

        engine.startPlayhead({ start: 0, end: 10 });
        flushFrames(2);

        expect(rAFCallbacks.length).toBe(1);
    });

    it('stops rAF after stopPlayhead()', () => {
        const engine = makeUIEngine(makeContext({ isPlaying: true }));
        engine.startPlayhead({ start: 0, end: 10 });
        engine.stopPlayhead();

        flushFrames(1); // flush the already-queued frame
        expect(rAFCallbacks.length).toBe(0);
    });
});