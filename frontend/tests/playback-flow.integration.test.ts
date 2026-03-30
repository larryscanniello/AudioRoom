import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillPlaybackBufferUtil } from '../src/Workers/opfs_utils/fillPlaybackBufferUtil';
import type { Region } from '../src/Types/AudioState';
import { readTo } from "../src/Workers/audioProcessorUtils/readTo";

/**
 * Integration test for the full playback flow:
 * Timeline data → fillPlaybackBufferUtil → SharedArrayBuffer → AudioProcessor reads
 */
const BUFFER_SIZE = 128*16;
const PROCESS_FRAMES = 128;

type BounceEntry = {
    dirHandle: FileSystemDirectoryHandle;
    takeHandles: {[key: string]: any};
};

type TimelineState = {
    staging: Region[][];
    mix: Region[][];
    startSample: number;
    endSample: number;
    posSample: {
        staging: number;
        mix: number;
    };
};

function createTimelineObject(stagingNums:number[][],mixNums:number[][][],range:{start:number,end:number}):TimelineState{
    const timeline:TimelineState = {
        staging: [stagingNums.map((nums,i) => {
            const reg:Region = {
                id: `staging_${i}`,
                start: nums[0],
                end: nums[1],
                take: i,
                bounce: mixNums.length,
                name: `bounce_${mixNums.length}_take_${i}`,
                clipOffset: 0,
                latencyOffset: 0,
                audioLength: nums[1] - nums[0],
            };
            return reg;
        })],
        //to handle empty mix, pass in [[]]
        mix: mixNums.map((track,i)=>
            track.map((nums,j)=>{
                const reg:Region = {
                    id: `mix_${i}_${j}`,
                    start: nums[0],
                    end: nums[1],
                    take: j,
                    bounce: i,
                    name: `bounce_${i}_take_${j}`,
                    clipOffset: 0,
                    latencyOffset: 0,
                    audioLength: nums[1] - nums[0],
                };
                return reg;
            })
        ),
        startSample: range.start,
        endSample: range.end,
        posSample: {
            staging: range.start,
            mix: range.start,
        },
    };

    return timeline;
}

function getAudioData(timeline:TimelineState){
    const audioData: Float32Array[] = [];

    let length = timeline.mix.reduce((acc,curr)=>acc+curr.length,0);
    length += timeline.staging.reduce((acc,curr)=>acc+curr.length,0);

    for (let i = 0; i < length; i++) {
        const arr = new Float32Array(BUFFER_SIZE*4);
        arr.fill((i+1)/1000);
        audioData.push(arr);
    }
    return audioData;
}

function getBounceEntries(timeline:TimelineState,audioData:Float32Array[]):BounceEntry[]{
    const bounceEntries:BounceEntry[] = [];
    let count = 0;
    for(let i=0;i<timeline.mix.length;i++){
        bounceEntries.push({
            dirHandle: {} as any,
            takeHandles: {},
        });
        for(let j=0;j<timeline.mix[i].length;j++){
            const audioDataIndex = count;
            bounceEntries[i].takeHandles[`bounce_${i}_take_${j}`] = {
                read: vi.fn((buffer: Float32Array, options: { at: number }) => {
                    const offset = options.at / Float32Array.BYTES_PER_ELEMENT;
                    const length = Math.min(buffer.length, audioData[audioDataIndex].length - offset);
                    for (let k = 0; k < length; k++) {
                        buffer[k] = audioData[audioDataIndex][offset + k];
                    }
                    return length;
                }),
            };
            count++;
        }
    }

    bounceEntries.push({
        dirHandle: {} as any,
        takeHandles: {} as any,
    });

    const totalMixRegions = timeline.mix.reduce((acc,curr)=>acc+curr.length,0);

    for(let i=0;i<timeline.staging[0].length;i++){
        bounceEntries[timeline.mix.length].takeHandles[`bounce_${timeline.mix.length}_take_${i}`] = {
            read: vi.fn((buffer: Float32Array, options: { at: number }) => {
                    const offset = options.at / Float32Array.BYTES_PER_ELEMENT;
                    const length = Math.min(buffer.length, audioData[totalMixRegions + i].length - offset);
                    for (let k = 0; k < length; k++) {
                        buffer[k] = audioData[totalMixRegions + i][offset + k];
                    }
                    return length;
            }),
        };
        count++;
    }
    return bounceEntries;
}

function runSimulation(
    timeline:TimelineState,
    bounceEntries:BounceEntry[],
    looping:boolean,
    simSamples:number,
):{mixRes:Float32Array,stagingRes:Float32Array}{
    const mixTrackCount = timeline.mix.length;
    const stagingTrackCount = timeline.staging.length;

    // Allocate SABs sized as BUFFER_SIZE * TRACK_COUNT so that
    // buffer.length / TRACK_COUNT = BUFFER_SIZE exactly — this ensures
    // readTo.js (no Math.floor) and fillPlaybackBufferUtil (Math.floor) agree on trackBufferLen.
    const mixSAB = new SharedArrayBuffer(BUFFER_SIZE * 4 * mixTrackCount + 12);
    const mixRead = new Int32Array(mixSAB, 0, 1);
    const mixWrite = new Int32Array(mixSAB, 4, 1);
    const mixIsFull = new Int32Array(mixSAB, 8, 1);
    const mixBuffer = new Float32Array(mixSAB, 12);

    const stagingSAB = new SharedArrayBuffer(BUFFER_SIZE * 4 * stagingTrackCount + 12);
    const stagingRead = new Int32Array(stagingSAB, 0, 1);
    const stagingWrite = new Int32Array(stagingSAB, 4, 1);
    const stagingIsFull = new Int32Array(stagingSAB, 8, 1);
    const stagingBuffer = new Float32Array(stagingSAB, 12);

    const readsNeeded = Math.ceil(simSamples / PROCESS_FRAMES);
    const mixRes = new Float32Array(readsNeeded * PROCESS_FRAMES * mixTrackCount);
    const stagingRes = new Float32Array(readsNeeded * PROCESS_FRAMES);

    const mixReader = new Float32Array(PROCESS_FRAMES * mixTrackCount);
    const stagingReader = new Float32Array(PROCESS_FRAMES * stagingTrackCount);

    const timelineRange = { start: timeline.startSample, end: timeline.endSample };
    let mixPos = timeline.posSample.mix;
    let stagingPos = timeline.posSample.staging;
    let mixCount = 0;
    let stagingCount = 0;

    const maxIter = readsNeeded * 4 + 10;
    for (let iter = 0; iter < maxIter; iter++) {
        // Fill mix buffer if there is space
        if (!Atomics.load(mixIsFull, 0)) {
            const { newWritePtr, timelinePos } = fillPlaybackBufferUtil(
                mixBuffer, mixTrackCount,
                Atomics.load(mixWrite, 0), Atomics.load(mixRead, 0),
                timeline.mix, bounceEntries,
                looping, mixPos, timelineRange
            );
            mixPos = timelinePos;
            Atomics.store(mixWrite, 0, newWritePtr);
            Atomics.store(mixIsFull, 0, 1);
        }

        // Fill staging buffer if there is space
        if (!Atomics.load(stagingIsFull, 0)) {
            const { newWritePtr, timelinePos } = fillPlaybackBufferUtil(
                stagingBuffer, stagingTrackCount,
                Atomics.load(stagingWrite, 0), Atomics.load(stagingRead, 0),
                timeline.staging, bounceEntries,
                looping, stagingPos, timelineRange
            );
            stagingPos = timelinePos;
            Atomics.store(stagingWrite, 0, newWritePtr);
            Atomics.store(stagingIsFull, 0, 1);
        }

        // Read from mix into accumulator
        const wasMixRead = readTo(mixReader, { read: mixRead, write: mixWrite, isFull: mixIsFull }, mixBuffer, mixTrackCount);
        if (wasMixRead && mixCount < readsNeeded) {
            const mixResTrackLen = mixRes.length / mixTrackCount;
            for (let k = 0; k < mixTrackCount; k++) {
                for (let j = 0; j < PROCESS_FRAMES; j++) {
                    mixRes[k * mixResTrackLen + mixCount * PROCESS_FRAMES + j] = mixReader[k * PROCESS_FRAMES + j];
                }
            }
            mixCount++;
        }

        // Read from staging into accumulator
        const wasStagingRead = readTo(stagingReader, { read: stagingRead, write: stagingWrite, isFull: stagingIsFull }, stagingBuffer, stagingTrackCount);
        if (wasStagingRead && stagingCount < readsNeeded) {
            stagingRes.set(stagingReader.subarray(0, PROCESS_FRAMES), stagingCount * PROCESS_FRAMES);
            stagingCount++;
        }

        if (mixCount >= readsNeeded && stagingCount >= readsNeeded) break;
    }

    return {stagingRes, mixRes};
}

describe('Basic Region Playback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should read a single mix region the size of the buffer', () => {
        const staging = [[]];
        const mix = [[[0,BUFFER_SIZE]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        stagingRes.forEach(v => expect(v).toBe(0));
        for(let i=0; i<simSamples;i++){
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=simSamples;i<mixRes.length;i++){
             expect(mixRes[i]).toBe(0);
        }

    });

    it('should read a single mix region twice the size of the buffer', () => {
        const staging = [[]];
        const mix = [[[0,BUFFER_SIZE*2]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*2});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*2;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        stagingRes.forEach(v => expect(v).toBe(0));
        for(let i=0; i<simSamples;i++){
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(mixRes[i]).toBe(0);
        }

    });

    it('should read a single staging region the size of the buffer',()=>{
        const staging = [[0,BUFFER_SIZE]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
             expect(mixRes[i]).toBe(0);
        }
    });

    it('should read a single staging region twice the size of the buffer',()=>{
        const staging = [[0,BUFFER_SIZE*2]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*2});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*2;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
             expect(mixRes[i]).toBe(0);
        }
    });

    it('should read a single staging region 3.5 times the size of the buffer',()=>{
        const staging = [[0,BUFFER_SIZE*3.5]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*3.5});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*3.5;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
             expect(mixRes[i]).toBe(0);
        }
    });

    it('should read a single mix region 3.5 times the size of the buffer',()=>{
        const staging = [[]];
        const mix = [[[0,BUFFER_SIZE*3.5]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*3.5});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*3.5;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should read a single mix region that is .3 times the size of the buffer',()=>{
        const staging = [[]];
        const mix = [[[0,Math.floor(BUFFER_SIZE*.3)]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:Math.floor(BUFFER_SIZE*.3)});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = Math.floor(BUFFER_SIZE*.3);

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should read a single staging region that is .3 times the size of the buffer',()=>{
        const staging = [[0,Math.floor(BUFFER_SIZE*.3)]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:Math.floor(BUFFER_SIZE*.3)});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = Math.floor(BUFFER_SIZE*.3);

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should read a single staging region that doesnt start at the beginning and handle silence appropriately',()=>{
        const staging = [[BUFFER_SIZE/2,3*BUFFER_SIZE/2]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<BUFFER_SIZE/2;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }

        for(let i=BUFFER_SIZE/2; i<3*BUFFER_SIZE/2;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=3*BUFFER_SIZE/2;i<2*BUFFER_SIZE;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });


    it('should read a single mix region that doesnt start at the beginning and handle silence appropriately',()=>{
        const staging = [[]];
        const mix = [[[BUFFER_SIZE/2,3*BUFFER_SIZE/2]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<BUFFER_SIZE/2;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }

        for(let i=BUFFER_SIZE/2; i<3*BUFFER_SIZE/2;i++){
            expect(mixRes[i]).toBeCloseTo(.001,5);
            expect(stagingRes[i]).toBe(0);
        }
        for(let i=3*BUFFER_SIZE/2;i<2*BUFFER_SIZE;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should read simultaneous mix and staging region',()=>{
        const staging = [[BUFFER_SIZE/2,3*BUFFER_SIZE/2]];
        const mix = [[[BUFFER_SIZE/2,3*BUFFER_SIZE/2]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<BUFFER_SIZE/2;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }

        for(let i=BUFFER_SIZE/2; i<3*BUFFER_SIZE/2;i++){
            expect(mixRes[i]).toBeCloseTo(.001,5);
            expect(stagingRes[i]).toBeCloseTo(.002,5);
        }
        for(let i=3*BUFFER_SIZE/2;i<2*BUFFER_SIZE;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should read 16 mix regions simultaneous with a staging region',()=>{
        const staging = [[BUFFER_SIZE/2,3*BUFFER_SIZE/2]];
        const mix = [];
        for(let i=0;i<16;i++){
            mix.push([[BUFFER_SIZE/2,3*BUFFER_SIZE/2]]);
        }

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,bounceEntries,looping,simSamples);

        for(let i=0; i<BUFFER_SIZE/2;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }

        const len = mixRes.length/16;
        for(let i=BUFFER_SIZE/2; i<3*BUFFER_SIZE/2;i++){
            for(let j=0;j<16;j++){
                expect(mixRes[j*len + i]).toBeCloseTo(.001*(j+1),5);
            }
            expect(stagingRes[i]).toBeCloseTo(17 *.001,5);
        }
        for(let i=3*BUFFER_SIZE/2;i<2*BUFFER_SIZE;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should zero-fill the remainder of a block when a region ends mid-block', () => {
        const staging = [[1, 129]];
        const mix = [[]];

        const timeline = createTimelineObject(staging, mix, { start: 0, end: BUFFER_SIZE });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);

        const { stagingRes } = runSimulation(timeline, bounceEntries, false, BUFFER_SIZE);

        expect(stagingRes[0]).toBe(0);
        for(let i=1;i<129;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
        }
        expect(stagingRes[129]).toBe(0);
    });

    it('should wrap around correctly when looping is enabled', () => {
        const timelineEnd = 100;
        const staging = [[10, 20]];
        const mix = [[[10,20]]];

        const timeline = createTimelineObject(staging, mix, { start: 0, end: timelineEnd });
        timeline.posSample.staging = 95;
        timeline.posSample.mix = 95;

        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 300;

        const { stagingRes, mixRes } = runSimulation(timeline, bounceEntries, true, simSamples);

        for(let i=0;i<3;i++){
            for(let j=0;j<15;j++){
                expect(stagingRes[i*100 + j]).toBe(0);
                expect(mixRes[i*100 + j]).toBe(0);
            }
            for(let j=15;j<25;j++){
                expect(stagingRes[i*100 +j]).toBeCloseTo(.002,5);
                expect(mixRes[i*100 +j]).toBeCloseTo(.001,5);
            }
            for(let j=25;j<100;j++){
                expect(stagingRes[i*100 + j]).toBe(0);
                expect(mixRes[i*100 + j]).toBe(0);
            }
        }
    });

    it('should handle regions that come one after the other', () => {
        const staging = [[0, 50],[50, 100]];
        const mix = [[[0,50],[50,100]]];
        const timeline = createTimelineObject(staging, mix, { start: 0, end: 200 });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 200;

        const { stagingRes,mixRes } = runSimulation(timeline, bounceEntries, false, simSamples);

        for(let i=0;i<50;i++){
            expect(stagingRes[i]).toBeCloseTo(.003,5);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=50;i<100;i++){
            expect(stagingRes[i]).toBeCloseTo(.004,5);
            expect(mixRes[i]).toBeCloseTo(.002,5);
        }
        for(let i=100;i<200;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should handle regions that with a small gap in between', () => {
        const staging = [[0, 50],[51, 101]];
        const mix = [[[0,50],[51,101]]];
        const timeline = createTimelineObject(staging, mix, { start: 0, end: 200 });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 200;

        const { stagingRes,mixRes } = runSimulation(timeline, bounceEntries, false, simSamples);

        for(let i=0;i<50;i++){
            expect(stagingRes[i]).toBeCloseTo(.003,5);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        expect(stagingRes[50]).toBe(0);
        expect(mixRes[50]).toBe(0);
        for(let i=51;i<101;i++){
            expect(stagingRes[i]).toBeCloseTo(.004,5);
            expect(mixRes[i]).toBeCloseTo(.002,5);
        }
        for(let i=101;i<200;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should handle regions that start before timeline start', () => {
        const staging = [[10, 50]];
        const mix = [[[10, 50]]];
        const timeline = createTimelineObject(staging, mix, { start: 30, end: 158 });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 128;

        const { stagingRes,mixRes } = runSimulation(timeline, bounceEntries, false, simSamples);

        for(let i=0;i<20;i++){
            expect(stagingRes[i]).toBeCloseTo(.002,5);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=20;i<128;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should handle regions that extend past timeline end', () => {
        const staging = [[0, 150]];
        const mix = [[[0, 150]]];
        const timeline = createTimelineObject(staging, mix, { start: 0, end: 100 });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 128;

        const { stagingRes,mixRes } = runSimulation(timeline, bounceEntries, false, simSamples);

        for(let i=0;i<100;i++){
            expect(stagingRes[i]).toBeCloseTo(.002,5);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=100;i<128;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should handle different overlapping regions across multiple mix tracks', () => {
        const staging = [[]];
        const mix = [
            [[0, 50]],
            [[25, 75]],
            [[50, 100]],
        ];
        const timeline = createTimelineObject(staging, mix, { start: 0, end: 100 });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 128;

        const { mixRes } = runSimulation(timeline, bounceEntries, false, simSamples);

        const mixResTrackLen = mixRes.length/timeline.mix.length;

        for(let i=0;i<50;i++){
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=50;i<128;i++){
            expect(mixRes[i]).toBe(0);
        }
        for(let i=mixResTrackLen;i<mixResTrackLen+25;i++){
            expect(mixRes[i]).toBe(0);
        }
        for(let i=mixResTrackLen+25;i<mixResTrackLen+75;i++){
            expect(mixRes[i]).toBeCloseTo(.002,5);
        }
        for(let i=mixResTrackLen+75;i<mixResTrackLen+128;i++){
            expect(mixRes[i]).toBe(0);
        }
        for(let i=2*mixResTrackLen;i<2*mixResTrackLen+50;i++){
            expect(mixRes[i]).toBe(0);
        }
        for(let i=2*mixResTrackLen+50;i<2*mixResTrackLen+100;i++){
            expect(mixRes[i]).toBeCloseTo(.003,5);
        }
    });

    it('should handle different non-overlapping regions across multiple mix tracks', () => {
        const staging = [[]];
        const mix = [
            [[0, 20]],
            [[30, 50]],
            [[60, 80]],
        ];
        const timeline = createTimelineObject(staging, mix, { start: 0, end: 100 });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 128;

        const { mixRes } = runSimulation(timeline, bounceEntries, false, simSamples);

        const mixResTrackLen = mixRes.length/timeline.mix.length;

        for(let i=0;i<20;i++){
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=20;i<mixResTrackLen+30;i++){
            expect(mixRes[i]).toBe(0);
        }
        for(let i=mixResTrackLen+30;i<mixResTrackLen+50;i++){
            expect(mixRes[i]).toBeCloseTo(.002,5);
        }
        for(let i=mixResTrackLen+50;i<2*mixResTrackLen+60;i++){
            expect(mixRes[i]).toBe(0);
        }
        for(let i=2*mixResTrackLen+60;i<2*mixResTrackLen+80;i++){
            expect(mixRes[i]).toBeCloseTo(.003,5);
        }
    });
});