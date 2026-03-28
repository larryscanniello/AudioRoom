import { EventTypes } from "@/Core/Events/EventNamespace"

interface PointerEntries {
    read: Int32Array,
    write: Int32Array,
    isFull: Int32Array,
    globalCount: Int32Array,
}

interface Pointers {
    staging: PointerEntries,
    mix: PointerEntries,
    record: {
        readOPFS: Int32Array,
        readStream: Int32Array,
        write: Int32Array,
        isFull: Int32Array,
        globalCount: Int32Array,
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
    start: number;           // Timeline position where clip begins (samples)
    end: number;             // Timeline position where clip ends (samples)
    take: number;
    bounce: number;
    name: string;
    clipOffset: number;      // Samples into source audio at region.start (0 = original recording)
    latencyOffset: number;   // Delay comp + user slip only (≤ 0.4s); inherited on split
    audioLength: number;     // Total usable samples in source file = timelineEnd - timelineStart
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
    readonly bounceNames: readonly string[];
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
            globalTake: number,
            globalPlayCount: number,
        },
        packetCount: number,
        bpm: number,
        latency: {
            totalDelayCompensationSamples: number,
            ctxLatencySamples: number,
        },
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