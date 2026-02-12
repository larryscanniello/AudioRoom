
import { Mixer } from "./Mixer";
import { Metronome } from "./Metronome";
import { MediaProvider } from "../MediaProvider";

import type { Pointers, Buffers } from "../../Types/AudioState";
import type { AudioProcessorData,StopAudioProcessorData } from "../../Types/AudioState";
import type { AudioEngine } from "./AudioEngine";
import type { DispatchEvent } from "../Mediator";

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

    constructor({hardware,mediaProvider,mixer}:WorkletAudioEngineDependencies) {
        this.#hardware = hardware;
        this.#mixer = mixer;
        this.#mediaProvider = mediaProvider;
        this.#metronome = new Metronome();
    }

    public update(event:DispatchEvent): void {
        event.execute(this);
    }

    public play(data: AudioProcessorData) {
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfs.postMessage(data);
    }

    public record(data: AudioProcessorData) {
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfs.postMessage(data);
    }

    public stop(data:StopAudioProcessorData) {
        this.#hardware.processorNode.port.postMessage(data);
        this.#hardware.opfs.postMessage(data);
    }

    public getMetronomeClickSound(): Float32Array{
        return this.#metronome.getClickBuffer();
    }

    public init(){
        this.#hardware.processorNode.port.postMessage({type: "init",memory: this.#hardware.memory});
        this.#hardware.opfs.postMessage({type: "init",memory: this.#hardware.memory});
    }

}