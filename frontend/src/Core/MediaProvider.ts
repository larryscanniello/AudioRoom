import type { DecodeAudioData } from "@/Types/AudioState";
import type { GlobalContext } from "./Mediator";
import { SetLatency } from "./Events/Audio/SetLatency";
import { CONSTANTS } from "@/Constants/constants";

export class MediaProvider {
    #standaloneMode: boolean = false;
    #videoAvailable: boolean = false;
    #AVStream: MediaStream | null = null;
    #audioStream: MediaStream | null = null;
    #remoteStream: MediaStream | null = null; 
    #sourceNode: MediaStreamAudioSourceNode | null = null;
    #audioContext: AudioContext;
    #handlePacket: ((data:DecodeAudioData) => void) | null = null;
    #globalContext: GlobalContext

    constructor(audioContext: AudioContext,standaloneMode:boolean, globalContext: GlobalContext) {
        this.#audioContext = audioContext;
        this.#standaloneMode = standaloneMode;
        this.#globalContext = globalContext;
        navigator.mediaDevices.ondevicechange = this.onDeviceChange.bind(this);
    }

    
    onDeviceChange(){
        const latency = this.#globalContext.query("latency");
        const prevCtxLatency = latency.ctxLatencySamples;
        const newCtxLatency = Math.round((this.#audioContext.outputLatency || 0) * CONSTANTS.SAMPLE_RATE);
        const delta = newCtxLatency - prevCtxLatency;
        const newTotalLatency = latency.totalDelayCompensationSamples + delta;
        const newLatency = {totalDelayCompensationSamples: newTotalLatency, ctxLatencySamples: newCtxLatency};
        console.log(`[Device Change] new latency`, newLatency);
        this.#globalContext.dispatch(SetLatency.getDispatchEvent({emit: false, param: newLatency, serverMandated: false}));
    }

    receivePacket(data: DecodeAudioData){
        if(!this.#handlePacket){
            throw new Error("No packet handler set for received audio packet");
        }
        this.#handlePacket(data);
    }

    setHandlePacket(handler: (data: DecodeAudioData) => void){
        this.#handlePacket = handler;
    }

    setRemoteStream(stream: MediaStream|null) {
        this.#remoteStream = stream;
    }

    getRemoteStream(): MediaStream | null {
        return this.#remoteStream;
    }

    getAudioStream(): MediaStream {
        if(!this.#audioStream){
            throw new Error("Audio Stream has not been loaded yet in MediaProvider");
        }
        return this.#audioStream;
    }

    getAVStream(): MediaStream | null {
        if(this.#standaloneMode){
            throw new Error("AV Stream is not available in standalone mode ");
        }
        return this.#AVStream;
    }

    isVideoAvailable(): boolean {
        return this.#videoAvailable;
    }

    getAudioContext(): AudioContext {
        return this.#audioContext;
    }

    getSourceNode(): MediaStreamAudioSourceNode {
        if(!this.#sourceNode){
            throw new Error("Source node has not been loaded yet in MediaProvider");
        }
        return this.#sourceNode;    
    }

    async loadStream(): Promise<GainNode|null>{
        const audioConstraints = {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
        };
        const wantVideo = !this.#standaloneMode;

        let stream = wantVideo
            ? await navigator.mediaDevices.getUserMedia({ video: true, audio: audioConstraints }).catch(() => null)
            : null;

        const gotVideo = stream !== null;

        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints }).catch(() => null);
        }

        if (!stream) {
            console.error('Error accessing media stream');
            return null;
        }

        this.#videoAvailable = gotVideo;
        if (!gotVideo) {
            this.#globalContext.commMessage("Camera unavailable — running in audio-only mode", "red");
        }

        const audioSource = this.#audioContext.createMediaStreamSource(stream);
        this.#sourceNode = audioSource;
        const chatGain = this.#audioContext.createGain();
        audioSource.connect(chatGain);
        const destination = this.#audioContext.createMediaStreamDestination();
        chatGain.connect(destination);

        const audioTrack = destination.stream.getAudioTracks()[0];
        const videoTracks = stream.getVideoTracks();
        this.#AVStream = videoTracks.length > 0
            ? new MediaStream([videoTracks[0], audioTrack])
            : new MediaStream([audioTrack]);
        this.#audioStream = new MediaStream(this.#AVStream.getAudioTracks());
        return chatGain;
    }


    terminate(){
        this.#AVStream?.getTracks().forEach(track => track.stop());
        this.#audioStream?.getTracks().forEach(track => track.stop());
    }
}