import type { Pointers, Buffers } from "../Types/audioengine";
import { Mixer } from "./Mixer";
import Metronome from "./Metronome";
import { SessionState } from "./SessionState";
import { MusicState } from "./MusicState";

export class AudioEngine {
    private audioContext: AudioContext;
    private Metronome: Metronome;
    private sessionState: SessionState;
    private pointers:Pointers;
    private buffers:Buffers;
    private mixer:Mixer;
    private stream: MediaStream | null = null;
    private processorNode: AudioWorkletNode | null = null;
    private musicState:MusicState;
    private sampleRate:number = 48000;

    constructor(SABs:{[key:string]:SharedArrayBuffer}, mixer:Mixer) {
        this.audioContext = mixer.getAudioContext();
        this.mixer = mixer;
        this.sessionState = new SessionState();
        this.Metronome = new Metronome(this.audioContext.sampleRate);
        const {stagingSAB, mixSAB, recordSAB} = SABs;

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

        this.musicState = new MusicState();

        this.processorNode = new AudioWorkletNode(this.audioContext,'AudioProcessor');
        this.processorNode.port.postMessage(
            {type:"init",
                buffers:this.buffers,
                pointers:this.pointers,
            }
        );
        this.processorNode.connect(this.audioContext.destination);

        this.initializeMediaStream()
            .then((mediaStream) => {
                if(mediaStream){
                    this.stream = mediaStream;
                    const sourceNode = this.audioContext.createMediaStreamSource(this.stream);
                    sourceNode.connect(this.processorNode!);
                }
            })
            .catch((error) => {
                console.error("Error initializing media stream:", error);
            });
    }

    public play(){
        if(!this.processorNode || this.sessionState.getIsRecording()) return;
        this.sessionState.setIsPlaying(true);
        this.sendPostMessageToProcessorNode("play");
    }

    public stop(){
        if(!this.processorNode) return;
        this.sessionState.setIsPlaying(false);
        this.sessionState.setIsRecording(false);
        this.sendPostMessageToProcessorNode("stop");
    }

    public getAudioContext(): AudioContext {
        return this.audioContext;
    }

    public getMetronome(): Metronome {
        return this.Metronome;
    }


    public async initializeMediaStream():Promise<MediaStream|void> {
       return await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
        }});
    }

    private sendPostMessageToProcessorNode(type:"play"|"record"|"stop"){
        if(!this.processorNode) return;
        if(type==="stop"){
            this.processorNode.port.postMessage({type,endTime:this.audioContext.currentTime * this.sampleRate});
            return;
        }
        this.processorNode.port.postMessage(
            {type,
                state:{
                    isRecording: type==="record",
                    isPlayback: type==="play",
                    isStreaming: true,
                    looping: this.musicState.getLooping(),
                    count:{
                        bounce: this.sessionState.getRecordData().bounce,
                        take: this.sessionState.getRecordData().take,
                    },
                    packetCount:0,
                },
                timeline:{
                    start: 0, //current playhead position in samples
                    end: null,   //end of playback (either region end or end of timeline) in samples
                    pos: 0, //current position in samples
                },
                absolute:{
                    start: Math.round(this.sampleRate * (this.audioContext.currentTime + .05)), //absolute time when playback starts
                    end: null, //absolute time when playback ends   
                    packetPos: 0, //position in packet you are in the 900 sample sized packet
                }

            });
        
    }
}