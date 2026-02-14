import type { GlobalContext } from "@/Core/Mediator";
import { CONSTANTS } from "@/Constants/constants";
import { SetMouseDragStart } from "@/Core/Events/UI/SetMouseDragStart";
import { SetMouseDragEnd } from "@/Core/Events/UI/SetMouseDragEnd";
import { MovePlayhead } from "@/Core/Events/UI/MovePlayhead";

export class HandleTimelineMouseDown {
    #context: GlobalContext;
    #windowLen: number = 0;
    #rectLeft: number = 0;
    #mouseDragStart: {t:number, trounded:number} | null = null;
    #mouseDragEnd: {t:number, trounded:number} | null = null;
    #viewportStartTime: number = 0;
    #viewportEndTime: number = 0;
    #isDragging: boolean = false;

    constructor(context: GlobalContext) {
        this.#context = context;
    }

    #calculateDragPos = (x: number) => {
        const totalViewportTime = this.#viewportEndTime - this.#viewportStartTime;
        const t = this.#viewportStartTime + (totalViewportTime * (x / this.#windowLen));
        const timeSignature = this.#context.query("timeSignature");
        const bpm = this.#context.query("bpm");
        
        // Default to 4/4 and 120bpm if not set
        const denom = timeSignature ? timeSignature.denominator : 4;
        const currentBpm = bpm || 120;

        const ticksPerQuarter = denom / 4;
        const secondsPerTick = 60 / currentBpm / ticksPerQuarter;

        // Snap to nearest tick
        const trounded = Math.round(t / secondsPerTick) * secondsPerTick;

        return { t, trounded };
    }
    
    timelineMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, ref: React.RefObject<HTMLElement|null>) => {
        if (this.#context.query("isPlaying")) return;
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        this.#windowLen = rect.width;
        this.#rectLeft = rect.left;
        const x = (e.clientX - this.#rectLeft);

        const viewport = this.#context.query("viewport");
        this.#viewportStartTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        this.#viewportEndTime = viewport.startTime + (this.#windowLen * samplesPerPx / CONSTANTS.SAMPLE_RATE);
        
        const coords = this.#calculateDragPos(x);
        
        this.#mouseDragStart = coords;
        this.#mouseDragEnd = null;
        this.#isDragging = true;
        
        // Dispatch start of interaction
        this.#context.dispatch(SetMouseDragStart.getDispatchEvent({ param: coords, emit: true }));

        window.addEventListener('mousemove', this.#handleCanvasMouseMove);
        window.addEventListener('mouseup', this.#handleCanvasMouseUp);
    };

    #handleCanvasMouseMove = (e: MouseEvent) => {
        if (!this.#isDragging) return;
        
        const x = e.clientX - this.#rectLeft;
        const viewportDuration = this.#viewportEndTime - this.#viewportStartTime;
        const pxPerSecond = this.#windowLen / viewportDuration;

        if (x < 0) {
            this.#mouseDragEnd = null;
        } else if (x > this.#windowLen) {
            const timeSignature = this.#context.query("timeSignature");
            const bpm = this.#context.query("bpm");
            const ticksPerQuarter = (timeSignature?.denominator || 4) / 4;
            const secondsPerTick = 60 / (bpm || 120) / ticksPerQuarter;
            
            const t = this.#viewportEndTime;
            const trounded = t - (t % secondsPerTick); // Snap end
            this.#mouseDragEnd = { t, trounded };
        } else {
            // Only update if moved more than 5px logic
            const startX = (this.#mouseDragStart!.t - this.#viewportStartTime) * pxPerSecond;
            if (Math.abs(startX - x) > 5) {
                this.#mouseDragEnd = this.#calculateDragPos(x);
            }
        }
        
        if (this.#mouseDragEnd) {
             this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: this.#mouseDragEnd, emit: true }));
        }
    }

    #handleCanvasMouseUp = (e: MouseEvent) => {
        this.#isDragging = false;
        window.removeEventListener("mousemove", this.#handleCanvasMouseMove);
        window.removeEventListener("mouseup", this.#handleCanvasMouseUp);
        
        if (!this.#mouseDragStart) return;

        const x = Math.max(0, Math.min(this.#windowLen, e.clientX - this.#rectLeft));
        const viewportDuration = this.#viewportEndTime - this.#viewportStartTime;
        const pxPerSecond = this.#windowLen / viewportDuration;
        const startX = (this.#mouseDragStart.t - this.#viewportStartTime) * pxPerSecond;

        const snapToGrid = this.#context.query("snapToGrid");

        if (Math.abs(startX - x) <= 5) {
            const loc = this.#mouseDragStart.t; 
            this.#context.dispatch(MovePlayhead.getDispatchEvent({ param: loc, emit: true }));
            this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: null, emit: true }));
        } else {
            const endPos = this.#calculateDragPos(x);
            let start = this.#mouseDragStart;
            let end = endPos;
            if (end.t < start.t) {
                [start, end] = [end, start];
            }

            const finalStart = snapToGrid ? start.trounded : start.t;
            
            this.#context.dispatch(MovePlayhead.getDispatchEvent({ param: finalStart, emit: true }));
            this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: { t: end.t, trounded: end.trounded}, emit: true }));
            
        }

        this.#mouseDragStart = null;
        this.#mouseDragEnd = null;
    };
}