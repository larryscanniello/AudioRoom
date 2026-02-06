import { MIPMAP_HALF_SIZE, MIX_MAX_TRACKS, SAMPLE_RATE } from "@/Constants/constants";
import { AudioController } from "../Audio/AudioController";
import { AudioEngine } from "../Audio/AudioEngine"
import { Mixer } from "../Audio/Mixer";

import { SocketManager } from "../Sockets/SocketManager";
import { MediaProvider } from "../MediaProvider";
import { WebRTCManager } from "../WebRTC/PeerJSManager";
import { WorkletAudioEngine } from "../Audio/WorkletAudioEngine";
import { Mediator, type GlobalContext } from "../Mediator";
import { UIEngine, type MipMap, type MipMap } from "../UI/UIEngine";
import { UIController } from "../UI/UIController";
import { KeydownManager } from "../UI/KeydownManager";
import { DOMHandlers } from "../UI/DOMHandlers";

type Config = {
    audEngineType: "worklet" | "C++" | "inmemory",
    mixer: boolean,
    standaloneMode: boolean,
    socketManager: boolean,
    webRTCManager: "peerjs" | false,
    roomID?: string,
}

export class SessionBuilder{
    #config: Config = {
        audEngineType: "worklet",
        mixer: false,
        standaloneMode: true,
        socketManager: false,
        webRTCManager: false,
        roomID: undefined,
    };
    #stateSetter: ((state: number) => void) | null = null;

    constructor(roomID?:string){
        this.#config.standaloneMode = roomID ? false : true;
        this.#config.roomID = roomID;
    }

    withReact(stateSetter: (state: number) => void){
        this.#stateSetter = stateSetter;
        return this;
    }

    withAudEngine(type: "worklet" | "C++" | "inmemory"){
        this.#config.audEngineType = type;
        return this;
    }

    withMixer(){
        this.#config.mixer = true;
        return this;
    }

    withSockets(){
        this.#config.socketManager = true;
        return this;        
    }

    withPeerJSWebRTC(){
        this.#config.socketManager = true;
        this.#config.webRTCManager = "peerjs";
        return this;
    }

    #allocateBuffersandPointers() {
        const stagingSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);
        const mixSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT * MIX_MAX_TRACKS + 12);
        const recordSAB = new SharedArrayBuffer(SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);

        const buffers = {
            staging: new Float32Array(stagingSAB,12),
            mix: new Float32Array(mixSAB,12),
            record: new Float32Array(recordSAB,12),
        };

        const pointers = {
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
        return {buffers, pointers};
    }

    #allocateMipMap():MipMap {
        const stagingMipMap = new SharedArrayBuffer(2*MIPMAP_HALF_SIZE);
        const mixMipMap = new SharedArrayBuffer(2*MIPMAP_HALF_SIZE);
        return { 
            staging: new Int8Array(stagingMipMap), 
            mix: new Int8Array(mixMipMap),
            empty: new Int8Array(0),
        };
    }

    #getAudioEngine(){
        const audioContext = new AudioContext({latencyHint: "interactive"});
        let audioEngine: AudioEngine;
        let processorNode = undefined; 
        let memory = undefined;
        let mixer = undefined;
        if(this.#config.mixer){
            mixer = new Mixer();
        }
        if(true /*temporary*/ || this.#config.audEngineType === "worklet"){
            processorNode = new AudioWorkletNode(audioContext,'AudioProcessor');
            memory = this.#allocateBuffersandPointers();
            const source = null;
            const hardware = {audioContext, processorNode, source, memory};
            audioEngine = new WorkletAudioEngine({hardware,mediaProvider: this.#mediaProvider,mixer});
        }
        return audioEngine
    }

    #getUIEngine(context:GlobalContext){
        const keydownManager = new KeydownManager(context);
        const domHandlers = new DOMHandlers(context);
        const mipMap = this.#allocateMipMap();
        return new UIEngine(keydownManager, domHandlers, mipMap);
    }


    build(): {audioController: AudioController, uiController: UIController, webRTCManager?: WebRTCManager} {
        const mediator = new Mediator();
        const mediaProvider = new MediaProvider(new AudioContext({latencyHint: "interactive"}), this.#config.standaloneMode);
        const socketManager = this.#config.socketManager ? new SocketManager() : undefined;
        const webRTCManager = this.#config.webRTCManager ? new WebRTCManager(mediaProvider,socketManager!.getSocket()) : undefined;
        const globalContext = mediator.getGlobalContext();
        const audioEngine = this.#getAudioEngine();
        const audioController = new AudioController(audioEngine, globalContext);
        const uiEngine = this.#getUIEngine(globalContext);
        const uiController = new UIController(UIEngine, globalContext);
        mediator.attach(audioEngine);
        mediator.attach(UIEngine);
        if(this.#socketManager){
            mediator.attach(this.#socketManager);
        }
        if(this.#webRTCManager){
            mediator.attach(this.#webRTCManager);
        }
        return {audioController, uiController,webRTCManager};
    }

}