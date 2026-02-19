import { EventTypes } from "@/Core/Events/EventNamespace"

interface PointerEntries {
    read: Uint32Array,
    write: Uint32Array,
    isFull: Uint32Array,
}

interface Pointers {
    staging: PointerEntries,
    mix: PointerEntries,
    record: {
        readOPFS: Uint32Array,
        readStream: Uint32Array,
        write: Uint32Array,
        isFull: Uint32Array,
    },
    opus: PointerEntries,
}

interface Buffers {
    staging: Float32Array,
    mix: Float32Array,
    record: Float32Array,
    opus: Float32Array,
}

type TimeSignature = {
    numerator: number,
    denominator: number,    
}

export type DecodeAudioData = {
    type: 'decode',
    packet: Float32Array,
    packetCount: number,
    isRecording: boolean,
    recordingCount: number,
    lookahead: number,
    last: boolean,
}

export interface Region {
    start: number;
    end: number;
    take: number;
    bounce:number,
    name: string;
    offset: number;
}

export interface TimelineState {
    readonly regionStack: readonly Region[];
    readonly staging: readonly Region[][];
    readonly mix: readonly Region[][];
    readonly redoStack: readonly Region[];
}

interface AddRegionAction {
    type: 'add_region';
    data: {
        timelineStart: number;
        timelineEnd: number;
        takeNumber: number;
        bounceNumber: number;
        fileName: string;
        delayCompensation: number[];
    };
    
}

interface BounceToMixAction {
    type: 'bounce_to_mix';
}

interface Absolute {
    start: number;
    end: number;
    pos: number;
}

interface AudioProcessorData {
    type: typeof EventTypes.START_RECORDING | typeof EventTypes.START_PLAYBACK;
    state: {
        isPlaying: boolean,
        isRecording: boolean,
        isStreaming: boolean,
        looping: boolean,
        count: {
            bounce: number,
            take: number,
        },
        packetCount: number,
    },
    timeline: {
        start: number,
        end: number,
        pos: number,
        staging: readonly Region[][],
        mix: readonly Region[][],
    }
}

interface StopAudioProcessorData {
    type:string,
}


export type Action = AddRegionAction | BounceToMixAction;


export type { Pointers, Buffers, TimeSignature, Absolute, AudioProcessorData, StopAudioProcessorData};