import type { TimelineState } from "../Types/AudioState"; // Assuming type exists based on AudioEngine
import timelineReducer from "./UI/timelineReducer";


export interface StateContainer {
    bpm: number;
    isStreaming: boolean;
    isLooping: boolean;
    isMetronomeOn: boolean;
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
    playheadTimeSeconds: number;
    mouseDragStart: { t: number; trounded: number };
    mouseDragEnd: { t: number; trounded: number } | null;
    numConnectedUsers: number;
    roomID: string | null;
    commMessage: {text: string; color: string};
    stagingMasterVolume: number;
    mixMasterVolume: number;
    stagingMuted: boolean;
    mixMuted: boolean;
}

export type TransactionQuery<K extends keyof StateContainer> = {
    key: K;
    comparitor: "<" | ">" | "===" | "<=" | ">=";
    target: StateContainer[K];
}
    
export type Mutation<K extends keyof StateContainer> = {
    key: K;
    value: StateContainer[K] | "++" | "toggle"; // "++" indicates an increment operation for number types
}

export type TransactionData = {
    transactionQueries: TransactionQuery<keyof StateContainer>[];
    mutations: Mutation<keyof StateContainer>[];
}

export class State {
    #reactState: Set<string>;
    #state: StateContainer = {
            bpm: 100,
            isLooping: true,
            isStreaming: false,
            isMetronomeOn: true,
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
            playheadTimeSeconds: 0,
            mouseDragStart: { t: 0, trounded: 0 },
            mouseDragEnd: null,
            numConnectedUsers: 0,
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

    #comparitor<K extends keyof StateContainer>(q:TransactionQuery<K>): boolean {
            const {key, comparitor, target} = q;
            const currentValue = this.query(key);
            if(comparitor === "==="){
                return currentValue === target;
            }
            if(typeof currentValue !== "number" || typeof target !== "number"){
                    console.error(`Comparitor ${comparitor} is only valid for number types. 
                        Current value type: ${typeof currentValue}, target type: ${typeof target}`);
                    return false;   
            }
            switch(comparitor){
                case "<":
                    return currentValue < target;
                case ">":
                    return currentValue > target;
                case "<=":
                    return currentValue <= target;
                case ">=":
                    return currentValue >= target;
            }
    }

    transaction(transaction: TransactionData): boolean {
            let canExecute = true;
            for(let tQuery of transaction.transactionQueries){
                canExecute = canExecute && this.#comparitor(tQuery);
            }
            if(canExecute){
                for(let mutation of transaction.mutations){
                    this.update(mutation.key, mutation.value);
                }
                return true;
            }else{
                return false;
            }
        }
    
    public update<K extends keyof StateContainer>(key: K, value: StateContainer[K]|"++"): void {
        let newvalue = value;
        if(newvalue === "++"){ // Handle increment mutation
            const currentVal = this.query(key);
            if(typeof currentVal === "number"){
                newvalue = currentVal + 1 as StateContainer[K];
            }else{
                throw new Error(`Cannot apply "++" mutation to non-number type. Current value type: ${typeof currentVal}`);
            }
        }
        this.#state[key] = newvalue;
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