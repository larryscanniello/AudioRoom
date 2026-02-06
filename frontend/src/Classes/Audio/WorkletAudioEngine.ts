
import { Mixer } from "./Mixer";
import { Metronome } from "./Metronome";
import { StreamProvider } from "../MediaProvider";

import type { Pointers, Buffers } from "../../Types/AudioState";
import type { AudioProcessorData,StopAudioProcessorData } from "../../Types/AudioState";
import type { AudioEngine } from "./AudioEngine";

type Hardware = {
    audioContext: AudioContext,
    processorNode: AudioWorkletNode
    source: MediaStreamAudioSourceNode|null,
    memory: Memory,
}

type WorkletAudioEngineDependencies = {
    hardware:Hardware,
    streamProvider?: StreamProvider,
    mixer?: Mixer,
}

type Memory = {
    buffers: Buffers,
    pointers: Pointers
}

export class WorkletAudioEngine implements AudioEngine{
    #mixer: Mixer|undefined;
    #hardware: Hardware;
    #metronome: Metronome;
    #streamProvider: StreamProvider|undefined;

    constructor({hardware,streamProvider,mixer}:WorkletAudioEngineDependencies) {
        this.#hardware = hardware;
        this.#mixer = mixer;
        this.#streamProvider = streamProvider;
        this.#metronome = new Metronome();
    }

    public async getAudioStream(){
        await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
        }})
        .then((stream) => {
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.source.connect(this.processorNode);
        })
        .catch((err) => {
            console.error('Error accessing audio stream:', err);
        });
    }

    public update<S>(event:AudioEvent<S>): void {
        event.execute(this);
    }

    public play(data: AudioProcessorData) {
        this.processorNode.port.postMessage(data);
    }

    public record(data: AudioProcessorData) {
        this.processorNode.port.postMessage(data);
    }

    public stop(data:StopAudioProcessorData) {
        this.processorNode.port.postMessage(data);
    }

    public getMetronomeClickSound(): Float32Array{
        return this.metronome.getClickBuffer();
    }


}