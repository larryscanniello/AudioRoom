import type { TimelineState } from "../../Types/AudioState"; // Assuming type exists based on AudioEngine


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
    remoteStreamAttached: boolean;
    liveRecording: {start: number, end:number};
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

/*
    This is an object with an array of queries and array of mutations.
    If the queries all succeed, then the mutations will be applied.
    For 2+ people, I use an optimistic approach with distributed state.
    First, the event is applied locally.
    then the event will be sent to the server for validation. If the server approves the event,
    then the event will be applied on all clients. If the server denies the event, 
    then the server will send a new state snapshot that will override the current state snapshot.
*/
export type TransactionData = {
    transactionQueries: TransactionQuery<keyof StateContainer>[];
    mutations: Mutation<keyof StateContainer>[];
}

export class State {
    #reactState: Set<keyof StateContainer>;
    #sharedState: Set<keyof StateContainer>;
    #commMessageTimeout: ReturnType<typeof setTimeout> | null = null;
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
            timeline: { staging: [[]], mix: [], regionStack: [], redoStack: [] },
            delayCompensation: [0],
            isPlaying: false,
            isRecording: false,
            bounce: 0,
            take: 0,
            playheadTimeSeconds: 0,
            mouseDragStart: { t: 0, trounded: 0 },
            mouseDragEnd: null,
            numConnectedUsers: 1,
            roomID: null,
            commMessage: {text:"",color:""},
            stagingMasterVolume: 1.0,
            mixMasterVolume: 1.0,
            stagingMuted: false,
            mixMuted: false,
            remoteStreamAttached: false,
            liveRecording: {start: 0, end: 0},
        };
    #render: React.Dispatch<React.SetStateAction<number>> | null = null;

    constructor(roomID: string | null = null) {
        this.#reactState = new Set([
            "bpm","isLooping","isStreaming","isMetronomeOn",
            "snapToGrid","timeline","delayCompensation",
            "commMessage","stagingMasterVolume","mixMasterVolume",
            "stagingMuted","mixMuted","playheadTimeSeconds","remoteStreamAttached",
        ]);
        this.#sharedState = new Set([
            "bpm","isLooping","timeSignature","timeline",
            "isPlaying","isRecording","bounce","take",
            "playheadTimeSeconds","mouseDragStart","mouseDragEnd",
            "numConnectedUsers","roomID","stagingMasterVolume",
            "mixMasterVolume","stagingMuted","mixMuted","liveRecording",
        ]);
        this.#state.roomID = roomID;
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

    getSharedStateSnapshot(): Partial<StateContainer> {
        const snapshot: Partial<StateContainer> = {};
        this.#sharedState.forEach(key => {
            snapshot[key] = this.query(key) as any;
        });
        return snapshot;
    }

    public commMessage(message:string,color:string,timeInMs:number = 5000): void{
        this.update("commMessage", {text: message, color: color});
        if(this.#commMessageTimeout){
            clearTimeout(this.#commMessageTimeout);
        }
        this.#commMessageTimeout = setTimeout(() => {
            this.update("commMessage", {text: "", color: "white"});
            this.#commMessageTimeout = null;
        }, timeInMs);

    }


}