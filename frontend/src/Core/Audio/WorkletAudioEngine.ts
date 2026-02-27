
import { Mixer } from "./Mixer";
import { MediaProvider } from "../MediaProvider";
import { MIXER_PARAMS } from "@/Constants/MixerParams";

import type { Pointers, Buffers, DecodeAudioData } from "../../Types/AudioState";
import type { AudioProcessorData,StopAudioProcessorData } from "../../Types/AudioState";
import type { AudioEngine } from "./AudioEngine";
import type { DispatchEvent, GlobalContext } from "../Mediator";

import timelineReducer from "../State/timelineReducer";
import { RecordingFinished } from "../Events/Audio/RecordingFinished";

import type { OPFSEventData } from "@/Workers/opfs_worker";

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
    #mixer: Mixer;
    #hardware: Hardware;
    #mediaProvider: MediaProvider|undefined;
    #context: GlobalContext;

    constructor({hardware,mediaProvider,mixer,context}:WorkletAudioEngineDependencies) {
        this.#hardware = hardware;
        hardware.processorNode.port.onmessage = this.#workletOnMessage.bind(this);
        this.#mixer = mixer;
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
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfsWorker.postMessage(data);
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

    public toggleMetronome(): void {
        const isMetronomeOn = this.#context.query("isMetronomeOn");
        const param = this.#hardware.processorNode.parameters.get(MIXER_PARAMS.METRONOME_GAIN);
        if(param) param.value = isMetronomeOn ? 1 : 0;
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