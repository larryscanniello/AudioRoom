import { EventTypes, type AppEvent } from "../Events/AppEvent";
import { type Observer } from "@/Types/Observer";
import { UIEngine } from "./UIEngine";
import { KeydownManager } from "./KeydownManager";
import { DOMHandlers } from "./DOMHandlers"
import { StateContainer } from "../State";
import { DOMCommands,DOMElements } from "@/Constants/DOMElements";
import { setZoom } from "../Events/Canvas/setZoom"

import type { GlobalContext } from "../Mediator";

export class UIController {
    #context: GlobalContext;
    #UIEngine: UIEngine;

    constructor(engine:UIEngine,context:GlobalContext,) {
        this.#context = context;
        this.#UIEngine = engine;
    }

public registerContext(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLCanvasElement>): void {
    this.#UIEngine.registerContext(ID, ref);
}

public setZoom(newSliderVal:number){
    const widthRef = this.#getRef(DOMCommands.DRAW_TRACK_ONE_WAVEFORMS);
    const playheadRef = this.#getRef(DOMCommands.DRAW_PLAYHEAD);
    if(widthRef && playheadRef){
        this.#context.dispatch(new setZoom(newSliderVal, widthRef, playheadRef))
    }else{
        console.error("References for width or playhead were not available when setting zoom, setting zoom failed");
    }
}

public terminate() {
    this.#keydownManager.terminate();
}

#getRef(ID: keyof typeof DOMCommands): React.RefObject<HTMLElement> | undefined {
    return this.#UIEngine.getRef(ID);
}

}