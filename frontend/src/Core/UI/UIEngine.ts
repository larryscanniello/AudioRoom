import { DOMElements,DOMCommands } from "../../Constants/DOMElements"
import { drawMeasureTicks } from "./DrawCallbacks/measureTicks";
import { renderStagingWaveforms } from "./DrawCallbacks/renderStagingWaveforms";
import { drawCanvasContainer } from "./DrawCallbacks/canvasContainer"
import { renderMixWaveforms } from "./DrawCallbacks/renderMixWaveforms";
import { drawPlayhead} from "./DrawCallbacks/drawPlayhead"
import { renderStagingRegions } from "./DrawCallbacks/renderStagingRegions";
import { MipMapsDone } from "../Events/UI/MipMapsDone";
import { RecordingDrained } from "../Events/Audio/RecordingDrained";
import { SetLiveSlip } from "../Events/UI/SetLiveSlip";

import type { StateContainer } from "../State/State";
import type React from "react";
import { fillSelectedRegion } from "./DrawCallbacks/fillSelectedRegion";
import type { Observer } from "@/Types/Observer";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { MediaProvider } from "../MediaProvider";
import { PlayheadManager } from "./PlayheadManager";
import { renderMixRegion } from "./DrawCallbacks/renderMixRegion";

//Reminder: Implement init for mipmaps


export type MipMap = {
    staging:Int8Array;
    mix: Int8Array;
    empty: Int8Array;
}

export type UIHardware = {
    opfsWorker: Worker,
    mipMap: MipMap
}

export class UIEngine implements Observer{
    #refs: Map<keyof typeof DOMCommands, React.RefObject<HTMLElement|null>>;
    #mipMap: MipMap;
    #opfsWorker: Worker;
    #mediaProvider: MediaProvider;
    #playheadManager: PlayheadManager;
    #context: GlobalContext;
    #pendingSlipMipmaps: number = 0;
    #callbackObj: {[key in keyof typeof DOMCommands]: 
        (ref: React.RefObject<HTMLElement|null>, 
        data: StateContainer, 
        mipMap: Int8Array) => void};

    constructor(hardware: UIHardware, mediaProvider: MediaProvider, context: GlobalContext) {
        this.#mipMap = hardware.mipMap;
        this.#opfsWorker = hardware.opfsWorker;
        this.#opfsWorker.onmessage = this.opfsOnMessage.bind(this);
        this.#mediaProvider = mediaProvider;
        this.#context = context;
        this.#refs = new Map();
        this.#callbackObj =this.#getCallbackObj();
        this.#playheadManager = new PlayheadManager(this.#context, this.#mediaProvider.getAudioContext());
    }

    opfsOnMessage(e: MessageEvent){
        switch(e.data.type){
            case "staging_mipmap_done":
                this.#context.dispatch(MipMapsDone.getDispatchEvent({emit: false, param: null}));
                break;
            case "slip_mipmap_done":
                this.#pendingSlipMipmaps--;
                if (this.#pendingSlipMipmaps === 0) {
                    this.#context.dispatch(SetLiveSlip.getDispatchEvent({ emit: false, param: null }));
                    this.#context.dispatch(MipMapsDone.getDispatchEvent({ emit: false, param: null }));
                }
                break;
            case "bounce_to_mix_done":
                this.#context.dispatch(MipMapsDone.getDispatchEvent({emit: false, param: null}));
                break;
            case "re_stage_bounce_done":
                this.#context.dispatch(MipMapsDone.getDispatchEvent({emit: false, param: null}));
                break;
            case "recording_drained": {
                const timeline = this.#context.query("timeline");
                const lastRegion = timeline.lastRecordedRegion;
                if (lastRegion) {
                    this.renderNewRegion(lastRegion.start, lastRegion.end);
                }
                this.#context.dispatch(RecordingDrained.getDispatchEvent({ emit: true, param: null, serverMandated: false }));
                break;
            }
            default:
                console.warn(`Unrecognized message from OPFS worker: ${e.data.type}`);
        }
    }

    renderNewRegion(start:number,end:number){
        const timeline = this.#context.query("timeline");
        this.#opfsWorker.postMessage({
            type: "fill_staging_mipmap",
            timeline,start,end
        });
    }

    public renderNewRegionForSlip(start: number, end: number) {
        this.#pendingSlipMipmaps++;
        const timeline = this.#context.query("timeline");
        this.#opfsWorker.postMessage({
            type: "fill_staging_mipmap_slip",
            timeline, start, end,
        });
    }

    public clearLiveSlip() {
        this.#context.dispatch(SetLiveSlip.getDispatchEvent({ emit: false, param: null }));
    }

    public getRef(ID: keyof typeof DOMCommands): React.RefObject<HTMLElement|null>|undefined{
        return this.#refs.get(ID);
    }

    public update(event:DispatchEvent,data:any):void{
        const namespace = event.getEventNamespace();
        namespace.executeUI(this, data);
    }

    public registerRef(ID: keyof typeof DOMElements, ref: React.RefObject<HTMLElement|null>) {
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
            case DOMElements.TRACK_ONE_REGIONS:
                this.#refs.set(DOMCommands.RENDER_TRACK_ONE_REGIONS, ref);
                break;
            case DOMElements.TRACK_TWO:
                this.#refs.set(DOMCommands.DRAW_TRACK_TWO_WAVEFORMS, ref);
                this.#refs.set(DOMCommands.FILL_SELECTED_REGION_TRACK_TWO, ref);
                break;
            case DOMElements.TRACK_TWO_REGIONS:
                this.#refs.set(DOMCommands.RENDER_TRACK_TWO_REGIONS, ref);
                break;
            case DOMElements.TOUCH_OVERLAY:
                this.#refs.set(DOMCommands.DRAW_PLAYHEAD, ref);
                break;
        }
    }

    public draw(commands: (keyof typeof DOMCommands)[], data: StateContainer) {
        for(let command of commands){
            if (this.#pendingSlipMipmaps > 0 &&
                (command === DOMCommands.DRAW_TRACK_ONE_WAVEFORMS ||
                 command === DOMCommands.DRAW_TRACK_TWO_WAVEFORMS)) {
                continue;
            }
            const ref = this.#refs.get(command);
            if(ref && ref.current){
                const callback = this.#callbackObj[command];
                const mipMap = command === DOMCommands.DRAW_TRACK_ONE_WAVEFORMS ? this.#mipMap.staging : 
                                command === DOMCommands.DRAW_TRACK_TWO_WAVEFORMS ? this.#mipMap.mix : this.#mipMap.empty;
                if(callback){
                    callback(ref, data, mipMap);                
                }else{
                    console.error(`No callback found for command: ${command}`);
                }
            }
        }
    }

    startPlayhead(timeline: {start: number, end: number}){
        const playheadRef = this.#refs.get(DOMCommands.DRAW_PLAYHEAD);
        const waveformRef = this.#refs.get(DOMCommands.DRAW_TRACK_ONE_WAVEFORMS);
        if(!playheadRef || !playheadRef.current || !waveformRef || !waveformRef.current){
            console.error("Playhead or waveform ref not found when starting playhead loop, playheadRef:", playheadRef, "waveformRef:", waveformRef);
            return;
        }
        const audioCtx = this.#mediaProvider.getAudioContext();
        this.#playheadManager.playheadData = {isMoving:true, startTime: audioCtx.currentTime};
        if(!playheadRef ||!playheadRef.current || !waveformRef.current){
            console.error("Playhead or waveform ref not found when starting playhead loop");
            return;
        }
        this.#playheadManager.playheadLoop(playheadRef, waveformRef,timeline);
        
    }

    stopPlayhead(){
        this.#playheadManager.stop();
    }


    #getCallbackObj():
    {[key in keyof typeof DOMCommands]: 
        (ref: React.RefObject<HTMLElement|null>, 
        data: StateContainer, 
        mipMap: Int8Array) => void}{
        return {
            [DOMCommands.DRAW_CANVAS_CONTAINER]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {drawCanvasContainer(ref, data, mipMap)},
            [DOMCommands.DRAW_MEASURE_TICK_CONTAINER]: 
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {drawMeasureTicks(ref, data, mipMap)},
            [DOMCommands.DRAW_TRACK_ONE_WAVEFORMS]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {renderStagingWaveforms(ref,data,mipMap)},
            [DOMCommands.DRAW_TRACK_TWO_WAVEFORMS]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {renderMixWaveforms(ref,data,mipMap)},
            [DOMCommands.FILL_SELECTED_REGION_MEASURE_TICKS]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {fillSelectedRegion(ref,data,mipMap)},
            [DOMCommands.FILL_SELECTED_REGION_TRACK_ONE]: () => {},
            [DOMCommands.FILL_SELECTED_REGION_TRACK_TWO]: () => {},
            [DOMCommands.DRAW_PLAYHEAD]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {drawPlayhead(ref,data,mipMap)},
            [DOMCommands.RENDER_TRACK_ONE_REGIONS]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {renderStagingRegions(ref, data, mipMap)},
            [DOMCommands.RENDER_TRACK_TWO_REGIONS]:
                (ref: React.RefObject<HTMLElement|null>, data: StateContainer, mipMap: Int8Array) => {renderMixRegion(ref, data, mipMap)}
        }
    }

    init(){
        this.#opfsWorker.postMessage({type: "initUI", mipMap: this.#mipMap});
    }   

}