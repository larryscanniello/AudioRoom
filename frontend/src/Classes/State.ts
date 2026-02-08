import type { TimelineState } from "../Types/AudioState"; // Assuming type exists based on AudioEngine
import timelineReducer from "./UI/timelineReducer";


export interface StateContainer {
    bpm: number;
    isStreaming: boolean;
    isLooping: boolean;
    metronomeOn: boolean;
    viewport: {
        startTime: number;
        samplesPerPx: number;
    }
    timeSignature: {
        numerator: number;
        denominator: number;
    }
    snapToGrid: boolean;
    timeline: TimelineState;
    delayCompensation: number[];
    isPlaying: boolean;
    isRecording: boolean;
    bounce: number;
    take: number;
    playheadLocation: number;
    mouseDragStart: { t: number; trounded: number };
    mouseDragEnd: { t: number; trounded: number } | null;
    connectedUsers: number;
    roomID: string | null;
    commMessage: {text: string; color: string};
    stagingMasterVolume: number;
    mixMasterVolume: number;
    stagingMuted: boolean;
    mixMuted: boolean;
}


export class State {
    #reactState: Set<string>;
    #state: StateContainer = {
            bpm: 100,
            isLooping: true,
            isStreaming: false,
            metronomeOn: true,
            viewport: {
                startTime: 0,
                samplesPerPx: 1000,
            },
            timeSignature: {
                numerator: 4,
                denominator: 4
            },
            snapToGrid: true,
            timeline: { staging: [], mix: [], regionStack: [], redoStack: [] },
            delayCompensation: [0],
            isPlaying: false,
            isRecording: false,
            bounce: 0,
            take: 0,
            playheadLocation: 0,
            mouseDragStart: { t: 0, trounded: 0 },
            mouseDragEnd: null,
            connectedUsers: 0,
            roomID: null,
            commMessage: {text:"",color:""},
            stagingMasterVolume: 1.0,
            mixMasterVolume: 1.0,
            stagingMuted: false,
            mixMuted: false,
        };;
    #render: React.Dispatch<React.SetStateAction<number>> | null = null;

    constructor() {
        this.#reactState = new Set([
            "bpm","isLooping","isStreaming","metronomeOn",
            "snapToGrid","timeline","delayCompensation",
            "commMessage","stagingMasterVolume","mixMasterVolume",
            "stagingMuted","mixMuted","timeline",
        ]);
    }

    public query<K extends keyof StateContainer>(key: K): StateContainer[K] {
        return this.#state[key];
    }

    public update<K extends keyof StateContainer>(key: K, value: StateContainer[K]): void {
        this.#state[key] = value;
        if(this.#reactState.has(key)) {
            if(!this.#render) { 
                console.warn("Render function not set.");
                return;
            }
            this.#render(performance.now());
        }
    }

    public setRender(ReactRender: React.Dispatch<React.SetStateAction<number>>): void {
        this.#render = ReactRender;
    }

    public getSnapshot(): StateContainer {
        return { ...this.#state };
    }

    public commMessage(message:string,color:string){
        this.update("commMessage", {text: message, color: color});
    }

    public timelineUpdate(action: "add_region" | "bounce" ) {
        const timeline = this.query("timeline");
        this.update("timeline", timelineReducer(timeline, action));
    }
}