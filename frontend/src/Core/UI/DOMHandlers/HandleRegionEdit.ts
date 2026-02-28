import type { GlobalContext } from "@/Core/Mediator";
import { CONSTANTS } from "@/Constants/constants";
import { DOMElements } from "@/Constants/DOMElements";
import type { Region } from "@/Types/AudioState";
import timelineReducer from "@/Core/State/timelineReducer";
import { TrimRegion } from "@/Core/Events/Audio/TrimRegion";
import { MoveRegion } from "@/Core/Events/Audio/MoveRegion";
import { paintPlayhead } from "@/Core/UI/DrawCallbacks/drawPlayhead";

const EDGE_ZONE_PX = 8;
const STAGING_TOP_PX = 35;   // matches renderStagingRegions.ts top style
const MIN_REGION_SAMPLES = Math.round(0.1 * CONSTANTS.SAMPLE_RATE);

type DragMode = 'trim-start' | 'trim-end' | 'move';

type DragState = {
    mode: DragMode;
    region: Region;
    startX: number;         // px within overlay at mousedown
    origStart: number;      // region.start at mousedown (samples)
    origEnd: number;        // region.end at mousedown (samples)
    stagingHeight: number;  // px, for ghost rect
};

type HitResult = {
    region: Region;
    mode: DragMode;
    stagingHeight: number;
};

export class HandleRegionEdit {
    #context: GlobalContext;
    #refs: Map<keyof typeof DOMElements, React.RefObject<HTMLElement | null>>;
    #drag: DragState | null = null;

    constructor(context: GlobalContext) {
        this.#context = context;
        this.#refs = new Map();
    }

    registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement | null>) {
        this.#refs.set(ID, ref);
    }

    // ─── Coordinate helpers ───────────────────────────────────────────────

    #getViewportInfo(overlay: HTMLCanvasElement) {
        const viewport = this.#context.query("viewport");
        const timelinePxLen = overlay.offsetWidth;
        const viewportStart = viewport.startTime;
        const viewportEnd = viewportStart + timelinePxLen * viewport.samplesPerPx / CONSTANTS.SAMPLE_RATE;
        return { viewportStart, viewportEnd, timelinePxLen };
    }

    #samplesToPx(samples: number, viewportStart: number, viewportEnd: number, timelinePxLen: number): number {
        return (samples / CONSTANTS.SAMPLE_RATE - viewportStart) / (viewportEnd - viewportStart) * timelinePxLen;
    }

    #pxToSamples(px: number, viewportStart: number, viewportEnd: number, timelinePxLen: number): number {
        return Math.round((viewportStart + (px / timelinePxLen) * (viewportEnd - viewportStart)) * CONSTANTS.SAMPLE_RATE);
    }

    #snapSamples(samples: number): number {
        if (!this.#context.query("snapToGrid")) return samples;
        const bpm = this.#context.query("bpm");
        const timeSignature = this.#context.query("timeSignature");
        const ticksPerQuarter = (timeSignature?.denominator) / 4;
        const samplesPerTick = Math.round(CONSTANTS.SAMPLE_RATE * 60 / bpm / ticksPerQuarter);
        return Math.round(samples / samplesPerTick) * samplesPerTick;
    }

    // ─── Hit testing ──────────────────────────────────────────────────────

    hitTest(mouseX: number, mouseY: number): HitResult | null {
        const overlayRef = this.#refs.get(DOMElements.TOUCH_OVERLAY);
        const overlay = overlayRef?.current;
        if (!(overlay instanceof HTMLCanvasElement)) return null;

        const stagingHeight = Number(overlay.dataset.stagingheight);
        if (isNaN(stagingHeight)) return null;

        // Only handle staging track for now
        if (mouseY < STAGING_TOP_PX || mouseY >= STAGING_TOP_PX + stagingHeight) return null;

        const { viewportStart, viewportEnd, timelinePxLen } = this.#getViewportInfo(overlay);
        const regions = this.#context.query("timeline").staging[0] ?? [];

        for (const region of regions) {
            const regionLeft = this.#samplesToPx(region.start, viewportStart, viewportEnd, timelinePxLen);
            const regionRight = this.#samplesToPx(region.end, viewportStart, viewportEnd, timelinePxLen);

            if (mouseX < regionLeft - EDGE_ZONE_PX || mouseX > regionRight + EDGE_ZONE_PX) continue;

            let mode: DragMode;
            if (mouseX <= regionLeft + EDGE_ZONE_PX) {
                mode = 'trim-start';
            } else if (mouseX >= regionRight - EDGE_ZONE_PX) {
                mode = 'trim-end';
            } else {
                mode = 'move';
            }

            return { region, mode, stagingHeight };
        }

        return null;
    }

    // ─── Mouse down entry point ───────────────────────────────────────────

    mouseDown(e: React.MouseEvent<HTMLCanvasElement>): boolean {
        const overlayRef = this.#refs.get(DOMElements.TOUCH_OVERLAY);
        const overlay = overlayRef?.current;
        if (!(overlay instanceof HTMLCanvasElement)) return false;

        const rect = overlay.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const hit = this.hitTest(mouseX, mouseY);
        if (!hit) return false;

        this.#drag = {
            mode: hit.mode,
            region: hit.region,
            startX: mouseX,
            origStart: hit.region.start,
            origEnd: hit.region.end,
            stagingHeight: hit.stagingHeight,
        };

        window.addEventListener('mousemove', this.#onMouseMove);
        window.addEventListener('mouseup', this.#onMouseUp);
        return true;
    }

    // ─── Drag lifecycle ───────────────────────────────────────────────────

    #computeGhostBounds(mouseX: number, overlay: HTMLCanvasElement): { ghostLeft: number; ghostWidth: number } {
        if (!this.#drag) return { ghostLeft: 0, ghostWidth: 0 };

        const { viewportStart, viewportEnd, timelinePxLen } = this.#getViewportInfo(overlay);
        const deltaSamples = this.#pxToSamples(mouseX, viewportStart, viewportEnd, timelinePxLen)
                           - this.#pxToSamples(this.#drag.startX, viewportStart, viewportEnd, timelinePxLen);

        const { origStart, origEnd, region } = this.#drag;
        const clipStart = region.clipStart;
        const clipEnd = region.clipEnd;

        let ghostStartSamples: number;
        let ghostEndSamples: number;

        if (this.#drag.mode === 'trim-start') {
            ghostStartSamples = Math.max(clipStart, Math.min(origStart + deltaSamples, origEnd - MIN_REGION_SAMPLES));
            ghostEndSamples = origEnd;
        } else if (this.#drag.mode === 'trim-end') {
            ghostStartSamples = origStart;
            ghostEndSamples = Math.min(clipEnd, Math.max(origEnd + deltaSamples, origStart + MIN_REGION_SAMPLES));
        } else {
            const newStart = Math.max(0, origStart + deltaSamples);
            const actualDelta = newStart - origStart;
            ghostStartSamples = newStart;
            ghostEndSamples = origEnd + actualDelta;
        }

        const ghostLeft = Math.max(0, this.#samplesToPx(ghostStartSamples, viewportStart, viewportEnd, timelinePxLen));
        const ghostRight = this.#samplesToPx(ghostEndSamples, viewportStart, viewportEnd, timelinePxLen);
        const ghostWidth = Math.max(0, ghostRight - ghostLeft);

        return { ghostLeft, ghostWidth };
    }

    #drawGhost(overlay: HTMLCanvasElement, ghostLeft: number, ghostWidth: number) {
        if (!this.#drag) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(ghostLeft, STAGING_TOP_PX, ghostWidth, this.#drag.stagingHeight);
        this.#paintPlayheadOnOverlay(ctx, overlay);
    }

    #clearGhost() {
        const overlay = this.#refs.get(DOMElements.TOUCH_OVERLAY)?.current;
        if (!(overlay instanceof HTMLCanvasElement)) return;
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        this.#paintPlayheadOnOverlay(ctx, overlay);
    }

    #paintPlayheadOnOverlay(ctx: CanvasRenderingContext2D, overlay: HTMLCanvasElement) {
        paintPlayhead(
            ctx,
            overlay,
            this.#context.query('viewport'),
            this.#context.query('playheadTimeSeconds'),
            this.#context.query('liveRecording'),
            this.#context.query('timeline').staging[0] ?? [],
        );
    }

    #onMouseMove = (e: MouseEvent) => {
        if (!this.#drag) return;
        const overlay = this.#refs.get(DOMElements.TOUCH_OVERLAY)?.current;
        if (!(overlay instanceof HTMLCanvasElement)) return;

        const rect = overlay.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        const { ghostLeft, ghostWidth } = this.#computeGhostBounds(mouseX, overlay);
        this.#drawGhost(overlay, ghostLeft, ghostWidth);
    };

    #onMouseUp = (e: MouseEvent) => {
        window.removeEventListener('mousemove', this.#onMouseMove);
        window.removeEventListener('mouseup', this.#onMouseUp);
        this.#clearGhost();

        if (!this.#drag) return;
        const drag = this.#drag;
        this.#drag = null;

        const overlay = this.#refs.get(DOMElements.TOUCH_OVERLAY)?.current;
        if (!(overlay instanceof HTMLCanvasElement)) return;

        const rect = overlay.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const { viewportStart, viewportEnd, timelinePxLen } = this.#getViewportInfo(overlay);

        const deltaSamples = this.#pxToSamples(mouseX, viewportStart, viewportEnd, timelinePxLen)
                           - this.#pxToSamples(drag.startX, viewportStart, viewportEnd, timelinePxLen);

        const { origStart, origEnd, region } = drag;
        const clipStart = region.clipStart;
        const clipEnd = region.clipEnd;
        const timeline = this.#context.query("timeline");

        if (drag.mode === 'trim-start') {
            const rawStart = origStart + deltaSamples;
            const newStart = this.#snapSamples(
                Math.max(clipStart, Math.min(rawStart, origEnd - MIN_REGION_SAMPLES))
            );
            if (newStart === origStart) return;
            const newTimeline = timelineReducer(timeline, { type: 'trim_region', id: region.id, newStart, newEnd: origEnd });
            this.#context.dispatch(TrimRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));

        } else if (drag.mode === 'trim-end') {
            const rawEnd = origEnd + deltaSamples;
            const newEnd = this.#snapSamples(
                Math.min(clipEnd, Math.max(rawEnd, origStart + MIN_REGION_SAMPLES))
            );
            if (newEnd === origEnd) return;
            const newTimeline = timelineReducer(timeline, { type: 'trim_region', id: region.id, newStart: origStart, newEnd });
            this.#context.dispatch(TrimRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));

        } else {
            const newStart = Math.max(0, origStart + deltaSamples);
            const snappedStart = this.#snapSamples(newStart);
            const actualDelta = snappedStart - origStart;
            if (actualDelta === 0) return;
            const newTimeline = timelineReducer(timeline, { type: 'move_region', id: region.id, deltaSamples: actualDelta });
            this.#context.dispatch(MoveRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
        }
    };
}