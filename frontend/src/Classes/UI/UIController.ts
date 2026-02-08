import { EventTypes, type AppEvent } from "../Events/AppEvent";
import { type Observer } from "@/Types/Observer";
import { UIEngine } from "./UIEngine";
import { KeydownManager } from "./KeydownManager";
import { DOMHandlers } from "./DOMHandlers/DOMHandlers"
import { StateContainer } from "../State";
import { DOMCommands,DOMElements } from "@/Constants/DOMElements";
import { setZoom } from "../Events/Canvas/setZoom"
import { StateContainer } from "../State";

import type { GlobalContext } from "../Mediator";

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
    const playheadRef = this.#getRef(DOMCommands.DRAW_PLAYHEAD);
    const width = widthRef?.current.clientWidth;
    const playheadPosSeconds = this.#context.query("playheadLocation");
    if(widthRef && playheadRef){
        this.#context.dispatch(new setZoom(newSliderVal));
    }else{
        console.error("References for width or playhead were not available when setting zoom, setting zoom failed");
    }
}

public handlePlayheadMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    this.#DOMHandlers.handlePlayheadMouseDown(e);
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

public terminate() {
    this.#keydownManager.terminate();
}



}