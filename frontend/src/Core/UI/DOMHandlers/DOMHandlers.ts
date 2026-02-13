import type { GlobalContext } from "../../Mediator";
import { DOMElements } from "@/Constants/DOMElements";
import { HandleTimelineMouseDown } from "./HandleTimelineMouseDown";
import { HandlePlayheadMouseDown } from "./HandlePlayheadMouseDown";
import { HandleBPMBoxMouseDown } from "./HandleBPMBoxMouseDown";


export class DOMHandlers {
    #handleTimelineMouseDown: HandleTimelineMouseDown;
    #handlePlayheadMouseDown: HandlePlayheadMouseDown;
    #handleBPMBoxMouseDown: HandleBPMBoxMouseDown;
    #refs: Map<keyof typeof DOMElements, React.RefObject<HTMLElement|null>>;

    constructor(context: GlobalContext) {
        this.#refs = new Map();
        this.#handleTimelineMouseDown = new HandleTimelineMouseDown(context);
        this.#handlePlayheadMouseDown = new HandlePlayheadMouseDown(context);
        this.#handleBPMBoxMouseDown = new HandleBPMBoxMouseDown(context);    
    }

    public registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement|null>) {
        this.#refs.set(ID, ref);
    }

    timelineMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
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

}