
import { Mixer } from "./Mixer";
import { MediaProvider } from "../MediaProvider";
import { MIXER_PARAMS } from "@/Constants/MixerParams";

import type { Pointers, Buffers, DecodeAudioData } from "../../Types/AudioState";
import type { AudioProcessorData,StopAudioProcessorData } from "../../Types/AudioState";
import type { AudioEngine } from "./AudioEngine";
import type { DispatchEvent, GlobalContext } from "../Mediator";

import timelineReducer from "../State/timelineReducer";
import { RecordingFinished } from "../Events/Audio/RecordingFinished";
import { AutoStop } from "../Events/Audio/AutoStop";

import type { OPFSEventData } from "@/Workers/opfs_worker";
import { SetLatency } from "../Events/Audio/SetLatency";

import { CONSTANTS } from "@/Constants/constants";

type Hardware = {
    audioContext: AudioContext,
    processorNode: AudioWorkletNode
    opfsWorker: Worker,
    source: MediaStreamAudioSourceNode|null,
    memory: Memory,
    clickBuffer: Float32Array,
}

type WorkletAudioEngineDependencies = {
    hardware:Hardware,
    mediaProvider: MediaProvider,
    mixer: Mixer,
    context: GlobalContext,
}

type Memory = {
    buffers: Buffers,
    pointers: Pointers
}

export class WorkletAudioEngine implements AudioEngine{
    _mixer: Mixer;
    #hardware: Hardware;
    #mediaProvider: MediaProvider|undefined;
    #context: GlobalContext;

    constructor({hardware,mediaProvider,mixer,context}:WorkletAudioEngineDependencies) {
        this.#hardware = hardware;
        hardware.processorNode.port.onmessage = this.#workletOnMessage.bind(this);
        this._mixer = mixer;
        this.#mediaProvider = mediaProvider;
        this.#context = context;
    }
    
    #workletOnMessage(e: MessageEvent){
        switch(e.data.type){
            case "add_region":
                const prevTimeline = this.#context.query("timeline");
                const newTimeline = timelineReducer(prevTimeline, {type: "add_region", data: e.data});
                this.#context.dispatch(RecordingFinished.getDispatchEvent({param: newTimeline, emit: true}));
                break;
            case "playback_ended":
                const mouseDragEnd = this.#context.query("mouseDragEnd");
                const mouseDragStart = this.#context.query("mouseDragStart");
                const snapToGrid = this.#context.query("snapToGrid");
                const playheadTimeSeconds = this.#context.query("playheadTimeSeconds");
                const start = mouseDragEnd ? (snapToGrid ? mouseDragStart.trounded : mouseDragStart.t) : playheadTimeSeconds;
                this.#context.dispatch(
                    AutoStop.getDispatchEvent({
                        emit: true,
                        param: start,
                        serverMandated: false,
                    })
                );
                break;
            case "recording_ended":
                this.#hardware.opfsWorker.postMessage({ type: "stop_recording_drain" });
                break;
            case "latency_test_done": {
                const delaySamples: number = e.data.delaySamples;
                const ctxLatencySamples = Math.round((this.#hardware.audioContext.outputLatency || 0) * CONSTANTS.SAMPLE_RATE);
                const latency = {totalDelayCompensationSamples: delaySamples, ctxLatencySamples};
                this.#context.dispatch(SetLatency.getDispatchEvent({emit: false, param: latency, serverMandated: false}));
                const ctx = this.#hardware.audioContext;
                console.log(
                    `[LatencyTest] delay: ${delaySamples} samples /
                     ${((delaySamples / ctx.sampleRate) * 1000).toFixed(2)} ms, output latency: ${ctx.outputLatency} s / ${(ctx.outputLatency * 1000).toFixed(2)} ms`);
                break;
            }
        }
    }

    public update(event:DispatchEvent,data:any): void {
        const namespace = event.getEventNamespace();
        namespace.executeAudio(this,data);
    }

    public play(data: AudioProcessorData) {
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfsWorker.postMessage(data);
    }

    public record(data: AudioProcessorData) {
        this.#updateCtxLatency(data);
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfsWorker.postMessage(data);
    }

    #updateCtxLatency(data: AudioProcessorData){
        const outputLatency = this.#hardware.audioContext.outputLatency || 0;
        const delta = Math.round(outputLatency * CONSTANTS.SAMPLE_RATE) - data.state.latency.ctxLatencySamples;
        data.state.latency = {
            totalDelayCompensationSamples: data.state.latency.totalDelayCompensationSamples + delta,
            ctxLatencySamples: Math.round(outputLatency * CONSTANTS.SAMPLE_RATE),
        };
        this.#context.dispatch(SetLatency.getDispatchEvent({emit: false, param: data.state.latency, serverMandated: false}));
    }

    public stop(data:StopAudioProcessorData) {
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfsWorker.postMessage(data);
    }

    public otherPersonRecording(data: AudioProcessorData) {
        this.#hardware.opfsWorker.postMessage(data);
    }

    public bounce(data: OPFSEventData) {
        this.#hardware.opfsWorker.postMessage(data);
    }

    public regenerateMixMipmap(data: { type: "regenerate_mix_mipmap"; newMixTimelines: any }) {
        this.#hardware.opfsWorker.postMessage(data);
    }

    public toggleMetronome(): void {
        const isMetronomeOn = this.#context.query("isMetronomeOn");
        const param = this.#hardware.processorNode.parameters.get(MIXER_PARAMS.METRONOME_GAIN);
        if(param) param.value = isMetronomeOn ? 1 : 0;
    }

    public startLatencyTest(): void {
        this.#hardware.processorNode.port.postMessage({ type: "START_LATENCY_TEST" });
    }

    public handlePacket(data: DecodeAudioData){
        this.#hardware.opfsWorker.postMessage(data);
    }

    public init(){
        if(this.#hardware.source){
            this.#hardware.source.connect(this.#hardware.processorNode);
        }else{
            throw new Error("Source node is not initialized in WorkletAudioEngine. Cannot connect to processor node.");
        }
        this.#hardware.processorNode.connect(this.#hardware.audioContext.destination);
        this.#hardware.processorNode.port.postMessage({type: "initAudio",memory: this.#hardware.memory});
        this.#hardware.opfsWorker.postMessage({type: "initAudio",memory: this.#hardware.memory});
        this.#hardware.processorNode.port.postMessage(
            {type: "initMetronome", clickBuffer: this.#hardware.clickBuffer},
            [this.#hardware.clickBuffer.buffer]
        );
        if(!this.#mediaProvider){
            throw new Error("Media provider is not set in WorkletAudioEngine. Cannot set packet handler for incoming audio packets.");
        }        
        this.#mediaProvider.setHandlePacket(this.handlePacket.bind(this));
    }
}