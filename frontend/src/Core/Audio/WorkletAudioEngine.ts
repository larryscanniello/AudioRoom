
import { Mixer } from "./Mixer";
import { Metronome } from "./Metronome";
import { MediaProvider } from "../MediaProvider";

import type { Pointers, Buffers } from "../../Types/AudioState";
import type { AudioProcessorData,StopAudioProcessorData } from "../../Types/AudioState";
import type { AudioEngine } from "./AudioEngine";
import type { DispatchEvent, GlobalContext } from "../Mediator";

import timelineReducer from "../State/timelineReducer";
import { RecordingFinished } from "../Events/Audio/RecordingFinished";


type Hardware = {
    audioContext: AudioContext,
    processorNode: AudioWorkletNode
    opfsWorker: Worker,
    source: MediaStreamAudioSourceNode|null,
    memory: Memory,
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
    #metronome: Metronome;
    #mediaProvider: MediaProvider|undefined;
    #context: GlobalContext;

    constructor({hardware,mediaProvider,mixer,context}:WorkletAudioEngineDependencies) {
        this.#hardware = hardware;
        hardware.processorNode.port.onmessage = this.#workletOnMessage.bind(this);
        this.#mixer = mixer;
        this.#mediaProvider = mediaProvider;
        this.#metronome = new Metronome();
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

    public getMetronomeClickSound(): Float32Array{
        return this.#metronome.getClickBuffer();
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
    }
}