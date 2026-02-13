import { AudioController } from "../Audio/AudioController";
import type { AudioEngine } from "../Audio/AudioEngine"
import { Mixer } from "../Audio/Mixer";
import { CONSTANTS } from "@/Constants/constants";
import { SocketManager } from "../Sockets/SocketManager";
import { MediaProvider } from "../MediaProvider";
import { PeerJSManager } from "../WebRTC/PeerJSManager";
import { WorkletAudioEngine } from "../Audio/WorkletAudioEngine";
import { Mediator, type GlobalContext } from "../Mediator";
import { UIEngine } from "../UI/UIEngine";
import { UIController } from "../UI/UIController";
import { KeydownManager } from "../UI/KeydownManager";
import { DOMHandlers } from "../UI/DOMHandlers/DOMHandlers";
import { MIXER_PARAMS } from "@/Constants/MixerParams";
import { State } from "../State";
import type { MipMap } from "../UI/UIEngine";

type Config = {
    audEngineType: "worklet" | "C++" | "inmemory",
    standaloneMode: boolean,
    socketManager: boolean,
    webRTCManager: "peerjs" | false,
    roomID?: string,
    opfsFilePath?: string,
    workletFilePath?: string,
    numberOfMixTracks: number,
}

type BuildResult = {
    audioController: AudioController,
    uiController: UIController,
    webRTCManager?: PeerJSManager,
} 

export class SessionBuilder{
    #config: Config = {
        audEngineType: "worklet",
        standaloneMode: true,
        socketManager: false,
        webRTCManager: false,
        roomID: undefined,
        opfsFilePath: undefined,
        workletFilePath: undefined,
        numberOfMixTracks: 16,
    };
    #stateSetter: React.Dispatch<React.SetStateAction<number>> | null = null;

    constructor(roomID?:string){
        this.#config.standaloneMode = roomID ? false : true;
        this.#config.roomID = roomID;
    }

    withReact(stateSetter: React.Dispatch<React.SetStateAction<number>>){
        this.#stateSetter = stateSetter;
        return this;
    }

    withAudEngine(type: "worklet" | "C++" | "inmemory", filePaths?: {opfsFilePath: string, workletFilePath: string}){
        this.#config.audEngineType = type;
        if(type === "worklet" && filePaths){
            this.#config.audEngineType = "worklet";
            this.#config.opfsFilePath = filePaths.opfsFilePath;
            this.#config.workletFilePath = filePaths.workletFilePath;
        }
        return this;
    }

    withMixTracks(numberOfMixTracks: number){
        if(numberOfMixTracks < 1){
            throw new Error(`Number of mix tracks must be at least 1, received ${numberOfMixTracks}`);
        }
        this.#config.numberOfMixTracks = numberOfMixTracks;
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
        const stagingSAB = new SharedArrayBuffer(CONSTANTS.SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);
        const mixSAB = new SharedArrayBuffer(CONSTANTS.SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT * this.#config.numberOfMixTracks + 12);
        const recordSAB = new SharedArrayBuffer(CONSTANTS.SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT + 12);

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
        const stagingMipMap = new SharedArrayBuffer(2*CONSTANTS.MIPMAP_HALF_SIZE);
        const mixMipMap = new SharedArrayBuffer(2*CONSTANTS.MIPMAP_HALF_SIZE);
        return { 
            staging: new Int8Array(stagingMipMap), 
            mix: new Int8Array(mixMipMap),
            empty: new Int8Array(0),
        };
    }

    async #getAudioController(globalContext: GlobalContext, mediaProvider: MediaProvider){
        const audioContext = mediaProvider.getAudioContext();
        let audioEngine: AudioEngine;
        let processorNode = undefined; 
        let memory = undefined;
        let mixer = undefined;
        if(true /*temporary*/ || this.#config.audEngineType === "worklet"){
            if(!this.#config.workletFilePath){
                throw new Error("Worklet file path must be provided for worklet audio engine");
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            if(!this.#config.workletFilePath){
                throw new Error("Worklet file path must be provided for worklet audio engine");
            }
            try {
                await audioContext.audioWorklet.addModule(this.#config.workletFilePath);
            } catch (e) {
                throw new Error(`Failed to load worklet at '${this.#config.workletFilePath}'. \n1. Check Console for "Diagnostic pre-fetch" errors.\n2. If the file is valid JS, check inside 'AudioProcessor.js' for syntax errors.\nOriginal Error: ${e}`);
            }
            processorNode = new AudioWorkletNode(audioContext,'AudioProcessor');
            const stagingMasterVolumeParam = processorNode.parameters.get(MIXER_PARAMS.STAGING_MASTER_VOLUME);
            const mixMasterVolumeParam = processorNode.parameters.get(MIXER_PARAMS.MIX_MASTER_VOLUME);
            if(!stagingMasterVolumeParam || !mixMasterVolumeParam){
                throw new Error("Master volume parameters not found in audio worklet processor");
            }
            const volumeParams = {stagingMasterVolumeParam, mixMasterVolumeParam};
            mixer = new Mixer(this.#config.numberOfMixTracks, audioContext,volumeParams,globalContext);
            if(!this.#config.opfsFilePath){
                throw new Error("OPFS file path must be provided for worklet audio engine");
            }
            const opfsWorker = new Worker(this.#config.opfsFilePath,{type: "module"});
            memory = this.#allocateBuffersandPointers();
            const source = null;
            const hardware = {audioContext, processorNode, source, memory, opfsWorker};
            audioEngine = new WorkletAudioEngine({hardware,mixer,mediaProvider});
        }
        const audioController = new AudioController(audioEngine, globalContext,mixer);
        return {audioController, audioEngine};
    }

    #getUIController(context:GlobalContext, mediaProvider: MediaProvider){
        const keydownManager = new KeydownManager(context);
        const domHandlers = new DOMHandlers(context);
        const mipMap = this.#allocateMipMap();
        const uiEngine = new UIEngine(mipMap,mediaProvider, context);
        const uiController = new UIController(uiEngine, context, keydownManager, domHandlers);
        return {uiEngine, uiController};
    }

    async build(): Promise<BuildResult|null>{
        const state = new State();
        if(this.#stateSetter){
            state.setRender(this.#stateSetter);
        }
        const mediator = new Mediator(state);
        const globalContext = mediator.getGlobalContext();
        const mediaProvider = new MediaProvider(new AudioContext({latencyHint: "interactive"}), this.#config.standaloneMode);
        const socketManager = this.#config.socketManager ? new SocketManager(globalContext) : undefined;
        if(socketManager){ //later I want to enable just video chat alone, but for now, this will do
            socketManager.initDAWConnection();
        }
        const webRTCManager = this.#config.webRTCManager && socketManager ? new PeerJSManager(mediaProvider,globalContext,socketManager.getSocket()) : undefined;
        const {audioController,audioEngine} = await this.#getAudioController(globalContext,mediaProvider)
        
        const {uiEngine, uiController} = this.#getUIController(globalContext,mediaProvider);
        mediator.attach(audioEngine);
        mediator.attach(uiEngine);
        if(socketManager){
            mediator.attach(socketManager);
        }
        if(webRTCManager){
            mediator.attach(webRTCManager);
        }
        console.log("Session built with config:", this.#config);
        return {audioController, uiController,webRTCManager};
    }

}