import { UIEngine } from "./UIEngine";
import { KeydownManager } from "./KeydownManager";
import { DOMHandlers } from "./DOMHandlers/DOMHandlers"
import { DOMCommands,DOMElements } from "@/Constants/DOMElements";
import { calculateZoom } from "./calculateZoom";
import type { StateContainer } from "@/Core/State";

import type { GlobalContext } from "../Mediator";
import { Zoom } from "../Events/UI/Zoom";
import { DrawAllCanvases } from "../Events/UI/DrawAllCanvases";

export class UIController {
    #context: GlobalContext;
    #UIEngine: UIEngine;
    #DOMHandlers: DOMHandlers;
    #keydownManager: KeydownManager;

    constructor(engine:UIEngine,context:GlobalContext,keydownManager: KeydownManager, DOMHandlers: DOMHandlers) {
        this.#context = context;
        this.#UIEngine = engine;
        this.#keydownManager = keydownManager;
        this.#DOMHandlers = DOMHandlers;
    }

public registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement>): void {
    this.#UIEngine.registerRef(ID, ref);
    this.#DOMHandlers.registerRef(ID, ref);
}

public setZoom(newSliderVal:number){
    const widthRef = this.#getRef(DOMCommands.DRAW_TRACK_ONE_WAVEFORMS);
    if(!widthRef || !widthRef.current){
        console.error("Width reference was not available when setting zoom, setting zoom failed");
        return;
    }
    const width = widthRef.current.clientWidth;
    const newZoom = calculateZoom(this.#context.query.bind(this.#context),newSliderVal,width);
    this.#context.dispatch(Zoom.getDispatchEvent({emit: false, param: newZoom}));
}

public handlePlayheadMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    this.#DOMHandlers.playheadMouseDown(e);
}

public timelineMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    this.#DOMHandlers.timelineMouseDown(e);
}

#getRef(ID: keyof typeof DOMCommands): React.RefObject<HTMLElement> | undefined {
    return this.#UIEngine.getRef(ID);
}

public query<K extends keyof StateContainer>(query: K): StateContainer[K] {
    return this.#context.query(query);
}

public drawAllCanvases(){
    this.#context.dispatch(DrawAllCanvases.getDispatchEvent({emit:false,param:null}));
}

public terminate() {
    this.#keydownManager.terminate();
}



}