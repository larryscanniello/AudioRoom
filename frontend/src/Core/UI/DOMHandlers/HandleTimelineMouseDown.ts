import type { GlobalContext } from "@/Core/Mediator";
import { CONSTANTS } from "@/Constants/constants";
import { SetMouseDragStart } from "@/Core/Events/UI/SetMouseDragStart";
import { SetMouseDragEnd } from "@/Core/Events/UI/SetMouseDragEnd";
import { PlayheadMoveMouseDown } from "@/Core/Events/UI/PlayheadMoveMouseDown";

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

        const denom = timeSignature ? timeSignature.denominator : 4;
        const currentBpm = bpm || 120;
        const secondsPerTick = 60 / currentBpm / (denom / 4);
        const trounded = Math.round(t / secondsPerTick) * secondsPerTick;

        return { t, trounded };
    }

    timelineMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, ref: React.RefObject<HTMLElement|null>) => {
        if (this.#context.query("isPlaying")) return;
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        this.#windowLen = rect.width;
        this.#rectLeft = rect.left;
        const x = e.clientX - this.#rectLeft;

        const viewport = this.#context.query("viewport");
        this.#viewportStartTime = viewport.startTime;
        this.#viewportEndTime = viewport.startTime + (this.#windowLen * viewport.samplesPerPx / CONSTANTS.SAMPLE_RATE);

        const coords = this.#calculateDragPos(x);
        this.#mouseDragStart = coords;
        this.#mouseDragEnd = null;
        this.#isDragging = true;

        // Clear old selection immediately, then set new drag start
        this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: null, emit: true }));
        this.#context.dispatch(SetMouseDragStart.getDispatchEvent({ param: coords, emit: true }));

        window.addEventListener('mousemove', this.#handleCanvasMouseMove);
        window.addEventListener('mouseup', this.#handleCanvasMouseUp);
    };

    #handleCanvasMouseMove = (e: MouseEvent) => {
        if (!this.#isDragging) return;

        const x = Math.max(0, Math.min(this.#windowLen, e.clientX - this.#rectLeft));
        const pxPerSecond = this.#windowLen / (this.#viewportEndTime - this.#viewportStartTime);
        const startX = (this.#mouseDragStart!.t - this.#viewportStartTime) * pxPerSecond;

        if (Math.abs(startX - x) <= 5) return;

        this.#mouseDragEnd = this.#calculateDragPos(x);
        this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: this.#mouseDragEnd, emit: true }));
    }

    #handleCanvasMouseUp = (e: MouseEvent) => {
        this.#isDragging = false;
        window.removeEventListener("mousemove", this.#handleCanvasMouseMove);
        window.removeEventListener("mouseup", this.#handleCanvasMouseUp);

        if (!this.#mouseDragStart) return;

        const x = Math.max(0, Math.min(this.#windowLen, e.clientX - this.#rectLeft));
        const pxPerSecond = this.#windowLen / (this.#viewportEndTime - this.#viewportStartTime);
        const startX = (this.#mouseDragStart.t - this.#viewportStartTime) * pxPerSecond;
        const snapToGrid = this.#context.query("snapToGrid");

        if (Math.abs(startX - x) <= 5) {
            const loc = this.#mouseDragStart.t;
            this.#context.dispatch(PlayheadMoveMouseDown.getDispatchEvent({ param: loc, emit: true }));
            this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: null, emit: true }));
        } else {
            const endPos = this.#calculateDragPos(x);
            const start = this.#mouseDragStart;

            const finalStart = snapToGrid
                ? Math.min(start.trounded, endPos.trounded)
                : Math.min(start.t, endPos.t);

            this.#context.dispatch(PlayheadMoveMouseDown.getDispatchEvent({ param: finalStart, emit: true }));
            this.#context.dispatch(SetMouseDragEnd.getDispatchEvent({ param: endPos, emit: true }));
        }

        this.#mouseDragStart = null;
        this.#mouseDragEnd = null;
    };
}