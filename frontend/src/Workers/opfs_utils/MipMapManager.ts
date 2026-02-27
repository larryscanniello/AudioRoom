import { CONSTANTS } from "../../Constants/constants";
import type { Region, BounceEntry, MipMap } from "./types";

export class MipMapManager {
    readonly staging: Int8Array;
    readonly mix: Int8Array;

    private readonly buffer: Float32Array;
    private readonly halfSize: number;
    private readonly resolutions: number[];
    private readonly totalTimelineSamples: number;

    constructor(mipMap: MipMap) {
        if(!mipMap.staging || !mipMap.mix ){  
            throw new Error("Mipmaps not initialized in mipmapmanager")
        }
        this.staging = mipMap.staging;
        this.mix = mipMap.mix;

        this.halfSize = CONSTANTS.MIPMAP_HALF_SIZE;
        this.resolutions = CONSTANTS.MIPMAP_RESOLUTIONS;
        this.totalTimelineSamples = CONSTANTS.SAMPLE_RATE * CONSTANTS.TIMELINE_LENGTH_IN_SECONDS;
        this.buffer = new Float32Array(2 ** 16);
    }

    write(
        rangeOnTimeline: {startSample: number, endSample:number},
        timelines: readonly Region[][],
        bounces: BounceEntry[],
        target: "staging" | "mix",
        data?: Float32Array,
    ): void {
        const {startSample, endSample} = rangeOnTimeline;
        const mipMap = this[target];
        const { resolutions, totalTimelineSamples, buffer, halfSize } = this;

        const TRACK_COUNT = data ? 1 : timelines.length;
        const iterateAmount = totalTimelineSamples / resolutions[0];
        const MIPMAP_BUFFER_SIZE_PER_TRACK = Math.floor(buffer.length / TRACK_COUNT);

        let currBucket = 0;
        let bufferIndex = Math.floor(buffer.length / TRACK_COUNT);
        let max = -1;
        let min = 1;
        buffer.fill(0);

        let startBucket = Math.floor(startSample / iterateAmount);
        let iterateAmountMultiple = startBucket * iterateAmount;
        currBucket = startBucket;

        for (let i = startSample; i < endSample; i++) {
            if (bufferIndex >= MIPMAP_BUFFER_SIZE_PER_TRACK) {
                if (data) {
                    buffer.set(data);
                } else {
                    const readToEnd = Math.min(endSample, i + MIPMAP_BUFFER_SIZE_PER_TRACK);
                    this._readTo(i, readToEnd, timelines, buffer, bounces);;
                }
                bufferIndex = 0;
            }
            if (i >= iterateAmountMultiple) {
                iterateAmountMultiple += iterateAmount;
                mipMap[currBucket] = Math.max(-128, Math.min(127, Math.round(max * 127)));
                mipMap[halfSize + currBucket] = Math.max(-128, Math.min(127, Math.round(min * 127)));
                currBucket += 1;
                min = 1; max = -1;
            }
            let currSample = 0;
            for (let b = 0; b < TRACK_COUNT; b++) {
                currSample += buffer[b * MIPMAP_BUFFER_SIZE_PER_TRACK + bufferIndex];
            }
            max = Math.max(max, currSample);
            min = Math.min(min, currSample);
            bufferIndex += 1;
        }

        let count = 1;
        while (count < resolutions.length) {
            const currLevel = resolutions.slice(0, count).reduce((acc, curr) => acc + curr, 0);
            let highStart = currLevel + Math.floor(startBucket / 2 ** count);
            let highEnd = currLevel + Math.ceil(currBucket / 2 ** count);
            let lowIndex = (highStart - currLevel) * 2 + resolutions.slice(0, count - 1).reduce((acc, curr) => acc + curr, 0);
            for (let j = highStart; j < highEnd; j++) {
                mipMap[j] = Math.max(mipMap[lowIndex], mipMap[lowIndex + 1]);
                mipMap[j + halfSize] = Math.min(mipMap[halfSize + lowIndex], mipMap[halfSize + lowIndex + 1]);
                lowIndex += 2;
            }
            count += 1;
        }

        Atomics.store(mipMap, 0, mipMap[0]);
    }

    private _readTo(
        startSample: number,
        endSample: number,
        timelines: readonly Region[][],
        buffer: Float32Array,
        bounces: BounceEntry[],
    ): void {
        const MIPMAP_BUFFER_SIZE_PER_TRACK = Math.floor(buffer.length / timelines.length);
        for (let i = 0; i < timelines.length; i++) {
            let currPos = startSample;
            const currTimeline = timelines[i];
            let bufferPos = i * MIPMAP_BUFFER_SIZE_PER_TRACK;
            const bufferEndPos = bufferPos + (endSample - startSample);
            while (currPos < endSample) {
                const region = currTimeline.find(r => r.end > currPos);
                if (!region) {
                    buffer.subarray(bufferPos, bufferEndPos).fill(0);
                    currPos = endSample;
                } else if (region.start > currPos) {
                    const toFill = Math.min(region.start - currPos, bufferEndPos - bufferPos);
                    buffer.subarray(bufferPos, bufferPos + toFill).fill(0);
                    currPos += toFill;
                    bufferPos += toFill;
                } else {
                    const toFill = Math.min(region.end - currPos, bufferEndPos - bufferPos);
                    const subarray = buffer.subarray(bufferPos, bufferPos + toFill);
                    bounces[region.bounce].takeHandles[region.name].read(subarray, { at: (currPos - region.start) * Float32Array.BYTES_PER_ELEMENT });
                    currPos += toFill;
                    bufferPos += toFill;
                }
            }
        }
    }

    synchronize(): void {
        Atomics.load(this.mix, 0);
    }
}