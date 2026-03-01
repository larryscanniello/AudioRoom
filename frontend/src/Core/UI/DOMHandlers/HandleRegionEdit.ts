import type { GlobalContext } from "@/Core/Mediator";
import { CONSTANTS } from "@/Constants/constants";
import { DOMElements } from "@/Constants/DOMElements";
import type { Region } from "@/Types/AudioState";
import timelineReducer from "@/Core/State/timelineReducer";
import { TrimRegion } from "@/Core/Events/Audio/TrimRegion";
import { MoveRegion } from "@/Core/Events/Audio/MoveRegion";
import { DeleteRegion } from "@/Core/Events/Audio/DeleteRegion";
import { PasteRegion } from "@/Core/Events/Audio/PasteRegion";
import { paintPlayhead } from "@/Core/UI/DrawCallbacks/drawPlayhead";

const EDGE_ZONE_PX = 8;
const STAGING_TOP_PX = 35;   // matches renderStagingRegions.ts top style
const MIN_REGION_SAMPLES = Math.round(0.1 * CONSTANTS.SAMPLE_RATE);
const CLICK_THRESHOLD_PX = 4;

// Border styles
const BORDER_DEFAULT_LEFT  = '1px solid rgba(220, 220, 220, 0.3)';
const BORDER_DEFAULT_RIGHT = '1px solid rgba(220, 220, 220, 0.3)';
const BORDER_HOVER    = '2px solid rgba(200, 200, 200, 0.7)';
const BORDER_SELECTED = '2px solid rgba(220, 220, 220, 0.95)';

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
    #mouseDownX = 0;

    // Hover / selection / clipboard
    #hoveredId: string | null = null;
    #hoveredMode: DragMode | null = null;
    #selectedId: string | null = null;
    #clipboard: Region | null = null;

    // Guard so we attach the hover listener only once per canvas instance
    #attachedOverlay: HTMLCanvasElement | null = null;

    constructor(context: GlobalContext) {
        this.#context = context;
        this.#refs = new Map();
        window.addEventListener('keydown', this.#onKeydown);
    }

    registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement | null>) {
        this.#refs.set(ID, ref);
        if (ID === DOMElements.TOUCH_OVERLAY) {
            // Defer so ref.current is populated after the commit phase
            queueMicrotask(() => {
                const overlay = ref.current;
                if (!(overlay instanceof HTMLCanvasElement)) return;
                if (overlay === this.#attachedOverlay) return;
                if (this.#attachedOverlay) {
                    this.#attachedOverlay.removeEventListener('mousemove', this.#onHoverMove);
                    this.#attachedOverlay.removeEventListener('mouseleave', this.#onHoverLeave);
                }
                overlay.addEventListener('mousemove', this.#onHoverMove);
                overlay.addEventListener('mouseleave', this.#onHoverLeave);
                this.#attachedOverlay = overlay;
            });
        }
    }

    // ─── Style helpers ────────────────────────────────────────────────────

    #applyRegionStyles() {
        const container = this.#refs.get(DOMElements.TRACK_ONE_REGIONS)?.current;
        if (!(container instanceof HTMLElement)) return;
        for (const child of Array.from(container.children)) {
            if (!(child instanceof HTMLElement)) continue;
            const id = child.dataset.id;
            if (id === this.#selectedId) {
                child.style.border = BORDER_SELECTED;
            } else if (id === this.#hoveredId) {
                child.style.borderLeft   = BORDER_HOVER;
                child.style.borderRight  = BORDER_HOVER;
                child.style.borderTop    = BORDER_HOVER;
                child.style.borderBottom = BORDER_HOVER;
            } else {
                child.style.borderLeft   = BORDER_DEFAULT_LEFT;
                child.style.borderRight  = BORDER_DEFAULT_RIGHT;
                child.style.borderTop    = '';
                child.style.borderBottom = '';
            }
        }
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

    // ─── Hover ────────────────────────────────────────────────────────────

    #onHoverMove = (e: MouseEvent) => {
        if (this.#drag) return; // don't update hover during a drag
        const overlay = this.#attachedOverlay;
        if (!overlay) return;
        const rect = overlay.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const hit = this.hitTest(mouseX, mouseY);
        const newId   = hit ? hit.region.id : null;
        const newMode = hit ? hit.mode      : null;
        if (newId !== this.#hoveredId || newMode !== this.#hoveredMode) {
            this.#hoveredId   = newId;
            this.#hoveredMode = newMode;
            this.#applyRegionStyles();
            this.#refreshOverlayForHover(hit, overlay);
        }
    };

    #onHoverLeave = () => {
        const hadHover = this.#hoveredId !== null;
        this.#hoveredId   = null;
        this.#hoveredMode = null;
        if (hadHover) {
            this.#applyRegionStyles();
            const overlay = this.#attachedOverlay;
            if (overlay) this.#refreshOverlayForHover(null, overlay);
        }
    };

    // ─── Trim indicator ───────────────────────────────────────────────────

    #refreshOverlayForHover(hit: HitResult | null, overlay: HTMLCanvasElement) {
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        this.#paintPlayheadOnOverlay(ctx, overlay);

        if (!hit || hit.mode === 'move') {
            return;
        }
        

        const { viewportStart, viewportEnd, timelinePxLen } = this.#getViewportInfo(overlay);
        const trimEnd = hit.mode === 'trim-end';

        const regionLeft  = this.#samplesToPx(hit.region.start, viewportStart, viewportEnd, timelinePxLen);
        const regionRight = this.#samplesToPx(hit.region.end,   viewportStart, viewportEnd, timelinePxLen);
        const regionWidthPx = regionRight - regionLeft;

        const halfH = 6;  // half the triangle's perpendicular spread
        const depth = 9;  // how deep the base sits inside the region from the edge

        // Don't draw if region is too narrow to fit the arrow
        if (regionWidthPx < depth + 2) return;

        // Tip is AT the edge; base is depth px INSIDE the region
        const tipPx  = trimEnd ? regionRight : regionLeft;
        const basePx = trimEnd ? regionRight - depth : regionLeft + depth;

        const cy = STAGING_TOP_PX + hit.stagingHeight / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.beginPath();
        ctx.moveTo(basePx, cy - halfH);
        ctx.lineTo(basePx, cy + halfH);
        ctx.lineTo(tipPx,  cy);
        ctx.closePath();
        ctx.fill();
    }

    // ─── Keyboard ─────────────────────────────────────────────────────────

    #onKeydown = (e: KeyboardEvent) => {
        // Don't intercept if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        const ctrl = e.ctrlKey || e.metaKey;

        if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
            e.preventDefault();
            this.#deleteSelected();
            return;
        }
        if (ctrl && e.key === 'c') { e.preventDefault(); this.#copy(); return; }
        if (ctrl && e.key === 'x') { e.preventDefault(); this.#cut();  return; }
        if (ctrl && e.key === 'v') { e.preventDefault(); this.#paste(); return; }
    };

    #deleteSelected() {
        if (!this.#selectedId) return;
        const id = this.#selectedId;
        this.#selectedId = null;
        const timeline = this.#context.query('timeline');
        const newTimeline = timelineReducer(timeline, { type: 'delete_region', id });
        this.#context.dispatch(DeleteRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
        requestAnimationFrame(() => this.#applyRegionStyles());
    }

    #copy() {
        if (!this.#selectedId) return;
        const region = this.#context.query('timeline').staging[0]?.find(r => r.id === this.#selectedId);
        if (region) this.#clipboard = region;
    }

    #cut() {
        this.#copy();
        this.#deleteSelected();
    }

    #paste() {
        if (!this.#clipboard) return;
        const src = this.#clipboard;
        const playheadSamples = Math.round(this.#context.query('playheadTimeSeconds') * CONSTANTS.SAMPLE_RATE);
        const duration    = src.end - src.start;
        const leftBuffer  = src.start - src.clipStart;
        const rightBuffer = src.clipEnd - src.end;
        const pastedRegion: Region = {
            id:         crypto.randomUUID(),
            name:       src.name,
            take:       src.take,
            bounce:     src.bounce,
            offset:     src.offset,
            start:      playheadSamples,
            end:        playheadSamples + duration,
            clipStart:  playheadSamples - leftBuffer,
            clipEnd:    playheadSamples + duration + rightBuffer,
        };
        this.#selectedId = pastedRegion.id;
        const timeline = this.#context.query('timeline');
        const newTimeline = timelineReducer(timeline, { type: 'paste_region', region: pastedRegion });
        this.#context.dispatch(PasteRegion.getDispatchEvent({ emit: true, param: newTimeline, serverMandated: false }));
        requestAnimationFrame(() => this.#applyRegionStyles());
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
        if (!hit) {
            // Click on empty area → deselect
            if (this.#selectedId !== null) {
                this.#selectedId = null;
                this.#applyRegionStyles();
            }
            return false;
        }

        // Clear the trim indicator now that drag/click is starting
        this.#hoveredMode = null;
        this.#refreshOverlayForHover(null, overlay);

        this.#mouseDownX = mouseX;
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

        if (!this.#drag) return;
        const drag = this.#drag;
        this.#drag = null;

        const overlay = this.#refs.get(DOMElements.TOUCH_OVERLAY)?.current;
        if (!(overlay instanceof HTMLCanvasElement)) return;

        const rect = overlay.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        // Click (no meaningful drag) → select the region
        if (Math.abs(mouseX - this.#mouseDownX) < CLICK_THRESHOLD_PX) {
            this.#clearGhost();
            this.#selectedId = drag.region.id;
            this.#applyRegionStyles();
            return;
        }

        this.#clearGhost();

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

        // Reapply selection highlight after executeUI resets region styles
        requestAnimationFrame(() => this.#applyRegionStyles());
    };
}