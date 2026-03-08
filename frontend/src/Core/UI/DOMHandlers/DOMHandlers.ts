import type { GlobalContext } from "../../Mediator";
import { DOMElements } from "@/Constants/DOMElements";
import { HandleTimelineMouseDown } from "./HandleTimelineMouseDown";
import { HandlePlayheadMouseDown } from "./HandlePlayheadMouseDown";
import { HandleBPMBoxMouseDown } from "./HandleBPMBoxMouseDown";
import { HandleTimelineScroll } from "./HandleTimelineScroll";
import { HandleRegionEdit } from "./HandleRegionEdit";
import { HandleSlipEdit } from "./HandleSlipEdit";


export class DOMHandlers {
    #handleTimelineMouseDown: HandleTimelineMouseDown;
    #handlePlayheadMouseDown: HandlePlayheadMouseDown;
    #handleBPMBoxMouseDown: HandleBPMBoxMouseDown;
    #handleTimelineScroll: HandleTimelineScroll;
    #handleRegionEdit: HandleRegionEdit;
    #handleSlipEdit: HandleSlipEdit;
    #refs: Map<keyof typeof DOMElements, React.RefObject<HTMLElement|null>>;

    constructor(context: GlobalContext) {
        this.#refs = new Map();
        this.#handleTimelineMouseDown = new HandleTimelineMouseDown(context);
        this.#handlePlayheadMouseDown = new HandlePlayheadMouseDown(context);
        this.#handleBPMBoxMouseDown = new HandleBPMBoxMouseDown(context);
        this.#handleTimelineScroll = new HandleTimelineScroll(context);
        this.#handleRegionEdit = new HandleRegionEdit(context);
        this.#handleSlipEdit = new HandleSlipEdit(context);
    }

    public getHandleRegionEdit(): HandleRegionEdit {
        return this.#handleRegionEdit;
    }


    public registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement|null>) {
        this.#refs.set(ID, ref);
        this.#handleRegionEdit.registerRef(ID, ref);
    }

    timelineMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
        // Slip handle intercepts before region edit
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const slipRegion = this.#handleRegionEdit.hitTestSlip(mouseX, mouseY);
        if (slipRegion) {
            this.#handleSlipEdit.slipMouseDown(e, slipRegion.id, slipRegion.offset);
            return;
        }

        // Region editing intercepts next; if it handles the event, don't proceed to playhead logic.
        if (this.#handleRegionEdit.mouseDown(e)) return;

        const ref = this.#refs.get(DOMElements.CANVAS_CONTAINER);
        if(!ref || !ref.current){
            console.error("Reference for canvas container was not found when handling timeline mouse down");
            return;
        }
        this.#handleTimelineMouseDown.timelineMouseDown(e,ref);
    }

    playheadMouseDown(_e: React.MouseEvent<HTMLElement>) {
        const ref = this.#refs.get(DOMElements.TRACK_ONE);
        if (!ref) {
            console.error("Reference for playhead was not found when handling playhead mouse down");
            return;
        }
        if (!(ref.current instanceof HTMLCanvasElement)) {
            console.error("Reference for playhead is not a canvas element when handling playhead mouse down");
            return;
        }
        this.#handlePlayheadMouseDown.playheadMouseDown(ref.current);
    }

    bpmBoxMouseDown(e: React.MouseEvent<HTMLElement>) {
        this.#handleBPMBoxMouseDown.bpmBoxMouseDown(e);
    }

    timelineWheel(e: React.WheelEvent<HTMLDivElement>) {
        const ref = this.#refs.get(DOMElements.CANVAS_CONTAINER);
        if(!ref || !ref.current){
            console.error("Reference for canvas container was not found when handling timeline scroll");
            return;
        }
        this.#handleTimelineScroll.timelineScroll(e,ref);
    }

}