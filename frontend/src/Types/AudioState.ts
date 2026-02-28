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
}

interface Buffers {
    staging: Float32Array,
    mix: Float32Array,
    record: Float32Array,
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
    id: string;
    start: number;
    end: number;
    take: number;
    bounce: number;
    name: string;
    offset: number;
    clipStart: number;   
    clipEnd: number;  
}

export type MipmapRange = { start: number; end: number };

export type TimelineSnapshot = {
    readonly staging: readonly Region[][];
    readonly mix: readonly Region[][];
    readonly mipmapRanges: readonly MipmapRange[];
}

export interface TimelineState {
    readonly staging: readonly Region[][];
    readonly mix: readonly Region[][];
    readonly undoStack: readonly TimelineSnapshot[];
    readonly redoStack: readonly TimelineSnapshot[];
    readonly lastRecordedRegion: Region | null;
    readonly lastMipmapRanges: readonly MipmapRange[];
}

interface Absolute {
    start: number;
    end: number;
    pos: number;
}

interface AudioProcessorData {
    type: typeof EventTypes.START_RECORDING | typeof EventTypes.START_PLAYBACK | typeof EventTypes.OTHER_PERSON_RECORDING;
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
        bpm: number,
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


export type { Pointers, Buffers, TimeSignature, Absolute, AudioProcessorData, StopAudioProcessorData};