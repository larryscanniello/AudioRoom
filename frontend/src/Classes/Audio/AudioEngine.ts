import { Mixer } from "./Mixer";
import { Metronome } from "./Metronome";
import { SAMPLE_RATE } from "@/Constants/constants";

import type { Observer } from "../../Types/Observer"
import type { Pointers, Buffers } from "../../Types/AudioState";
import type { AudioEvent } from "../Events/AppEvent";
import type { AudioProcessorData,StopAudioProcessorData } from "../../Types/AudioState";

export class AudioEngine implements Observer<AudioEngine>{
    private mixer: Mixer;
    private audioContext: AudioContext;
    private metronome: Metronome;
    private buffers: Buffers;
    private pointers: Pointers
    private processorNode: AudioWorkletNode;
    private source: MediaStreamAudioSourceNode | null = null;

    constructor() {
        this.mixer = new Mixer();
        this.audioContext = this.mixer.getAudioContext();
        this.metronome = new Metronome();

        const stagingSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);
        const mixSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT * 16 + 12);
        const recordSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);

        this.buffers = {
            staging: new Float32Array(stagingSAB,12),
            mix: new Float32Array(mixSAB,12),
            record: new Float32Array(recordSAB,12),
        };

        this.pointers = {
            staging: {
                read: new Uint32Array(stagingSAB,0,1),
                write: new Uint32Array(stagingSAB,4,1),
                isFull: new Uint32Array(stagingSAB,8,1),
            },
            mix: {
                read: new Uint32Array(mixSAB,0,1),
                write: new Uint32Array(mixSAB,4,1),
                isFull: new Uint32Array(mixSAB,8,1),
            },
            record: {
                read: new Uint32Array(recordSAB,0,1),
                write: new Uint32Array(recordSAB,4,1),
                isFull: new Uint32Array(recordSAB,8,1),
            },
        };

        this.processorNode = new AudioWorkletNode(this.audioContext,'AudioProcessor');
        this.processorNode.port.postMessage(
            {type:"init",
                buffers:this.buffers,
                pointers:this.pointers,
            }
        );
        this.processorNode.connect(this.audioContext.destination);
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