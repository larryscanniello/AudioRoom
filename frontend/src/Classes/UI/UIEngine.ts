import { DOMElements,DOMCommands } from "../../Constants/DOMElements"
import { drawMeasureTicks } from "./DrawCallbacks/measureTicks";
import { MIPMAP_HALF_SIZE } from "@/Constants/constants";
import { renderStagingWaveforms } from "./DrawCallbacks/renderStagingWaveforms";
import { drawCanvasContainer } from "./DrawCallbacks/canvasContainer"
import { renderMixWaveforms } from "./DrawCallbacks/renderMixWaveforms";
import { setPlayhead } from "./DrawCallbacks/setPlayhead"

import type { CanvasEvent } from "../Events/AppEvent";
import type { StateContainer } from "../State";
import type React from "react";
import { fillSelectedRegion } from "./DrawCallbacks/fillSelectedRegion";
import type { Observer } from "@/Types/Observer";

export type MipMap = {
    staging:Int8Array;
    mix: Int8Array;
}

export class UIEngine implements Observer<UIEngine> {
    #refs: Map<keyof typeof DOMCommands, React.RefObject<HTMLElement>>;
    #drawCallbacks: Map<keyof typeof DOMCommands, 
                    (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => void>
    #mipMap: MipMap;
    #emptyInt8: Int8Array;

    constructor() {
        this.#refs = new Map();
        this.#drawCallbacks = new Map()
        const stagingMipMap = new SharedArrayBuffer(2*MIPMAP_HALF_SIZE);
        const mixMipMap = new SharedArrayBuffer(2*MIPMAP_HALF_SIZE);
        this.#mipMap = { 
            staging: new Int8Array(stagingMipMap), 
            mix: new Int8Array(mixMipMap),
        };
        this.#emptyInt8 = new Int8Array(0);
        this.getCallbackObj();
    }

    public getRef(ID: keyof typeof DOMCommands): React.RefObject<HTMLElement>|undefined{
        return this.#refs.get(ID);
    }

    public update<T>(event:CanvasEvent<T>):void{
        event.execute(this);
    }

    public registerContext(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLCanvasElement>) {
        switch(ID){
            case DOMElements.CANVAS_CONTAINER:
                this.#refs.set(DOMCommands.DRAW_CANVAS_CONTAINER, ref);
                break;
            case DOMElements.MEASURE_TICK_CONTAINER:
                this.#refs.set(DOMCommands.DRAW_MEASURE_TICK_CONTAINER, ref);
                this.#refs.set(DOMCommands.FILL_SELECTED_REGION_MEASURE_TICKS, ref);
                break;
            case DOMElements.TRACK_ONE:
                this.#refs.set(DOMCommands.DRAW_TRACK_ONE_WAVEFORMS, ref);
                this.#refs.set(DOMCommands.FILL_SELECTED_REGION_TRACK_ONE, ref);
                break;
            case DOMElements.TRACK_TWO:
                this.#refs.set(DOMCommands.DRAW_TRACK_TWO_WAVEFORMS, ref);
                this.#refs.set(DOMCommands.FILL_SELECTED_REGION_TRACK_TWO, ref);
                break;
            case DOMElements.PLAYHEAD:
                this.#refs.set(DOMCommands.DRAW_PLAYHEAD, ref);
                break;
        }
    }

    public draw(commands: (keyof typeof DOMCommands)[], data: StateContainer) {
        for(let command of commands){
            const ref = this.#refs.get(command);
            if(ref && ref.current){
                const callback = this.#drawCallbacks.get(command)
                const mipMap = command === DOMCommands.DRAW_TRACK_ONE_WAVEFORMS ? this.#mipMap.staging : 
                                command === DOMCommands.DRAW_TRACK_TWO_WAVEFORMS ? this.#mipMap.mix : this.#emptyInt8;
                if(callback){
                    callback(ref, data, mipMap);                
                }else{
                    console.error(`No callback found for command: ${command}`);
                }
            }
        }
    }

    private getCallbackObj():
    {[key in keyof typeof DOMCommands]: 
        (ref: React.RefObject<HTMLElement>, 
        data: StateContainer, 
        mipMap: Int8Array) => void}{
        return {
            [DOMCommands.DRAW_CANVAS_CONTAINER]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {drawCanvasContainer(ref, data, mipMap)},
            [DOMCommands.DRAW_MEASURE_TICK_CONTAINER]: 
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {drawMeasureTicks(ref, data, mipMap)},
            [DOMCommands.DRAW_TRACK_ONE_WAVEFORMS]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {renderStagingWaveforms(ref,data,mipMap)},
            [DOMCommands.DRAW_TRACK_TWO_WAVEFORMS]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {renderMixWaveforms(ref,data,mipMap)},
            [DOMCommands.FILL_SELECTED_REGION_MEASURE_TICKS]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {fillSelectedRegion(ref,data,mipMap)},
            [DOMCommands.FILL_SELECTED_REGION_TRACK_ONE]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {fillSelectedRegion(ref,data,mipMap)},
            [DOMCommands.FILL_SELECTED_REGION_TRACK_TWO]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {fillSelectedRegion(ref,data,mipMap)},
            [DOMCommands.DRAW_PLAYHEAD]:
                (ref: React.RefObject<HTMLElement>, data: StateContainer, mipMap: Int8Array) => {setPlayhead(ref,data,mipMap)}
        }
    }

}