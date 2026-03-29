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
import { CONSTANTS } from "@/Constants/constants";
import type { Region } from "@/Types/AudioState";

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

    public drawGhostWaveform(
        ctx: CanvasRenderingContext2D,
        region: Region,
        ghostLeft: number,
        ghostWidth: number,
        stagingTopPx: number,
        stagingHeight: number,
        viewport: { startTime: number; samplesPerPx: number },
        ghostStartSamples: number,
    ) {
        const mipMap = this.#mipMap.staging;
        const WIDTH = ctx.canvas.offsetWidth;
        const startTime = viewport.startTime;
        const endTime = startTime + WIDTH * viewport.samplesPerPx / CONSTANTS.SAMPLE_RATE;
        const vpStartSamples = Math.round(startTime * CONSTANTS.SAMPLE_RATE);
        const vpEndSamples   = Math.round(endTime   * CONSTANTS.SAMPLE_RATE);

        const resolutions = CONSTANTS.MIPMAP_RESOLUTIONS;
        const pxPerTimeline = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE /
                              (vpEndSamples - vpStartSamples) * WIDTH;
        let currRes = 0;
        while (currRes + 1 < resolutions.length && resolutions[currRes + 1] > pxPerTimeline) currRes++;

        const halfLength    = CONSTANTS.MIPMAP_HALF_SIZE;
        const iterateAmount = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / halfLength;
        const mipMapStart   = resolutions.slice(0, currRes).reduce((a, c) => a + c, 0);
        const pxGap         = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS / (endTime - startTime) * WIDTH / resolutions[currRes];

        const validStart = mipMapStart + Math.floor(Math.floor(region.start / iterateAmount) / Math.pow(2, currRes + 1));
        const validEnd   = mipMapStart + Math.floor(Math.floor(region.end   / iterateAmount) / Math.pow(2, currRes + 1));

        // True (unclamped) left edge of the ghost — may be negative if scrolled past viewport
        const ghostLeft_true = (ghostStartSamples / CONSTANTS.SAMPLE_RATE - startTime) / (endTime - startTime) * WIDTH;
        const samplesPerCanvasPx = (vpEndSamples - vpStartSamples) / WIDTH;

        Atomics.load(mipMap, 0);
        ctx.save();

        // Clip to ghost rect — prevents any float-edge bleed onto the playhead or outside bounds
        ctx.beginPath();
        ctx.rect(ghostLeft, stagingTopPx, ghostWidth, stagingHeight);
        ctx.clip();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth   = 1;
        ctx.lineCap     = 'round';

        // Iterate only over the visible ghost columns, looking up the correct mipmap bucket
        // for each canvas x position based on its offset from the true (unclamped) ghost start.
        let k = Math.ceil(ghostLeft / pxGap);
        while (k * pxGap < ghostLeft + ghostWidth) {
            const x = k * pxGap;
            const samplePos = region.start + Math.round((x - ghostLeft_true) * samplesPerCanvasPx);
            if (samplePos < region.end) {
                const mipIdx = mipMapStart + Math.floor(Math.floor(samplePos / iterateAmount) / Math.pow(2, currRes + 1));
                if (mipIdx >= validStart && mipIdx < validEnd) {
                    const maxAmp = mipMap[mipIdx]             / 127;
                    const minAmp = mipMap[halfLength + mipIdx] / 127;
                    const y1 = stagingTopPx + ((1 + minAmp) * stagingHeight) / 2;
                    const y2 = stagingTopPx + ((1 + maxAmp) * stagingHeight) / 2;
                    ctx.moveTo(x, y1);
                    ctx.lineTo(x, y2);
                }
            }
            k++;
        }
        ctx.stroke();
        ctx.restore();
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