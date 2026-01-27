import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillPlaybackBufferUtil } from '../public/opfs_utils/fillPlaybackBufferUtil';
import type { BounceEntry, TimelineState, Region } from '../public/opfs_utils/types';
import { fillMixPlaybackBuffer, fillStagingPlaybackBuffer, proceed } from '../public/opfs_worker';
import {readTo} from "../public/audioProcessorUtils/readTo"

/**
 * Integration test for the full playback flow:
 * Timeline data → fillPlaybackBufferUtil → SharedArrayBuffer → AudioProcessor reads
 */
const BUFFER_SIZE = 128*16;
const PROCESS_FRAMES = 128;

function createTimelineObject(stagingNums:number[][],mixNums:number[][][],range:{start:number,end:number}):TimelineState{
    const timeline:TimelineState = {
        staging: [stagingNums.map((nums,i) => {
            const reg:Region = {
                start: nums[0],
                end: nums[1],
                take: i,
                bounce: mixNums.length,
                name: `bounce_${mixNums.length}_take_${i}`,
                offset: 0,
            }
            return reg;
        })],
        //to handle empty mix, pass in [[]]
        mix: mixNums.map((track,i)=>
            track.map((nums,j)=>{
                const reg:Region = {
                    start: nums[0],
                    end: nums[1],
                    take: j,
                    bounce: i,
                    name: `bounce_${i}_take_${j}`,
                    offset: 0,
                }
                return reg;
            })
        ),
        start: range.start,
        end: range.end,
        pos: {
            staging: range.start,
            mix: range.start,
        }
    }

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
        })
        for(let j=0;j<timeline.mix[i].length;j++){
            const audioDataIndex = count; // Capture the current count for this closure
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
    })

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
        }
        count ++;
    }
    return bounceEntries;
    
}

function runSimulation(
    timeline:TimelineState,
    {stagingRead,stagingWrite,stagingIsFull}:{stagingRead:Uint32Array,stagingWrite:Uint32Array,stagingIsFull:Uint32Array},
    {mixRead,mixWrite,mixIsFull}:{mixRead:Uint32Array,mixWrite:Uint32Array,mixIsFull:Uint32Array},
    {stagingBuffer,mixBuffer}:{stagingBuffer:Float32Array,mixBuffer:Float32Array},
    bounceEntries:BounceEntry[],
    looping:boolean,
    simSamples:number,
):{mixRes:Float32Array,stagingRes:Float32Array}{
    const mixReader = new Float32Array(PROCESS_FRAMES * timeline.mix.length);
    const stagingReader = new Float32Array(PROCESS_FRAMES * timeline.staging.length);

    const simLength = simSamples;
    const mixRes = new Float32Array(2 * simLength * timeline.mix.length);
    const stagingRes = new Float32Array(2 * simLength);

    // Initialize proceed flags for testing
    proceed.mix = "ready";
    proceed.staging = "ready";

    fillMixPlaybackBuffer(mixRead,mixWrite,mixIsFull,mixBuffer,timeline.mix.length,bounceEntries,timeline,looping);
    fillStagingPlaybackBuffer(stagingRead,stagingWrite,stagingIsFull,stagingBuffer,timeline.staging.length,bounceEntries,timeline,looping);
    let mixCount = 0;
    let stagingCount = 0;
    const start = (vi.getMockedSystemTime() as Date).getTime();
    while((vi.getMockedSystemTime() as Date).getTime()-start<simLength*1000/48000){
        const wasMixRead = readTo(mixReader,{read:mixRead,write:mixWrite,isFull:mixIsFull},mixBuffer,timeline.mix.length);
        const wasStagingRead = readTo(stagingReader,{read:stagingRead,write:stagingWrite,isFull:stagingIsFull},stagingBuffer,timeline.staging.length);

        if(wasMixRead){
            const mixResTrackLen = mixRes.length/timeline.mix.length;
            for(let k=0;k<timeline.mix.length;k++){
                for(let j=0;j<128;j++){
                    mixRes[k*mixResTrackLen + (128*mixCount) +j] = mixReader[k*128+j];
                }
            }
            mixCount += 1;
        }
        if(wasStagingRead){
            stagingRes.set(stagingReader,stagingCount * 128);
            stagingCount += 1;
        }
        vi.advanceTimersByTime(1000*128/48000);
    }
    return {stagingRes,mixRes};
}

describe('Basic Region Playback', () => {
    let mixWrite: Uint32Array;
    let mixRead: Uint32Array;
    let mixIsFull: Uint32Array;
    let mixBuffer: Float32Array
    let stagingWrite: Uint32Array;
    let stagingRead: Uint32Array;
    let stagingIsFull: Uint32Array;
    let stagingBuffer: Float32Array
    let stagingPtrs:{
        stagingRead:Uint32Array,
        stagingWrite:Uint32Array,
        stagingIsFull:Uint32Array,
    };
    let mixPtrs:{
        mixRead:Uint32Array,
        mixWrite:Uint32Array,
        mixIsFull:Uint32Array,
    }
    let buffers:{
        stagingBuffer: Float32Array,
        mixBuffer: Float32Array,
    };


    beforeEach(() => {
        // Create mock audio data (1 second at 48kHz)
        vi.useFakeTimers();
        const mixSAB = new SharedArrayBuffer(BUFFER_SIZE*4+12);
        mixRead = new Uint32Array(mixSAB,0,1);
        mixWrite = new Uint32Array(mixSAB,4,1);
        mixIsFull = new Uint32Array(mixSAB,8,1);
        mixBuffer = new Float32Array(mixSAB,12);
        const stagingSAB = new SharedArrayBuffer(BUFFER_SIZE*4+12);
        stagingRead = new Uint32Array(stagingSAB,0,1);
        stagingWrite = new Uint32Array(stagingSAB,4,1);
        stagingIsFull = new Uint32Array(stagingSAB,8,1);
        stagingBuffer = new Float32Array(stagingSAB,12);

        mixPtrs = {mixRead,mixWrite,mixIsFull};
        stagingPtrs = {stagingRead,stagingWrite,stagingIsFull};
        buffers = {mixBuffer,stagingBuffer};

    

    });

    it('should read a single mix region the size of the buffer', () => {
        const staging = [[]];
        const mix = [[[0,BUFFER_SIZE]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

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

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

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

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
             expect(mixRes[i]).toBe(0);
        }
    })

    it('should read a single staging region twice the size of the buffer',()=>{
        const staging = [[0,BUFFER_SIZE*2]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*2});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*2;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
             expect(mixRes[i]).toBe(0);
        }
    })


    it('should read a single staging region 3.5 times the size of the buffer',()=>{
        const staging = [[0,BUFFER_SIZE*3.5]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*3.5});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*3.5;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
             expect(mixRes[i]).toBe(0);
        }
    })

    it('should read a single mix region 3.5 times the size of the buffer',()=>{
        const staging = [[]];
        const mix = [[[0,BUFFER_SIZE*3.5]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:BUFFER_SIZE*3.5});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = BUFFER_SIZE*3.5;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    })

    it('should read a single mix region that is .3 times the size of the buffer',()=>{
        const staging = [[]];
        const mix = [[[0,Math.floor(BUFFER_SIZE*.3)]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:Math.floor(BUFFER_SIZE*.3)});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = Math.floor(BUFFER_SIZE*.3);

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBeCloseTo(.001,5);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    })

    it('should read a single staging region that is .3 times the size of the buffer',()=>{
        const staging = [[0,Math.floor(BUFFER_SIZE*.3)]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:Math.floor(BUFFER_SIZE*.3)});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = Math.floor(BUFFER_SIZE*.3);

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<simSamples;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
            expect(mixRes[i]).toBe(0);
        }
        for(let i=simSamples;i<mixRes.length;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    })

    it('should read a single staging region that doesnt start at the beginning and handle silence appropriately',()=>{
        const staging = [[BUFFER_SIZE/2,3*BUFFER_SIZE/2]];
        const mix = [[]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

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
    })

    
    it('should read a single mix region that doesnt start at the beginning and handle silence appropriately',()=>{
        const staging = [[]];
        const mix = [[[BUFFER_SIZE/2,3*BUFFER_SIZE/2]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

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
    })

    it('should read simultaneous mix and staging region',()=>{
        const staging = [[BUFFER_SIZE/2,3*BUFFER_SIZE/2]];
        const mix = [[[BUFFER_SIZE/2,3*BUFFER_SIZE/2]]];

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

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
    })

    it('should read 16 mix regions simultaneous with a staging region',()=>{
        const staging = [[BUFFER_SIZE/2,3*BUFFER_SIZE/2]];
        const mix = [];
        for(let i=0;i<16;i++){
            mix.push([[BUFFER_SIZE/2,3*BUFFER_SIZE/2]])
        }

        const timeline: TimelineState = createTimelineObject(staging,mix,{start:0,end:2*BUFFER_SIZE});
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline,audioData);
        const looping = false;
        const simSamples = 2*BUFFER_SIZE;

        const {stagingRes,mixRes} = runSimulation(timeline,stagingPtrs,mixPtrs,buffers,bounceEntries,looping,simSamples);

        for(let i=0; i<BUFFER_SIZE/2;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }

        const len = mixRes.length/16;
        for(let i=BUFFER_SIZE/2; i<3*BUFFER_SIZE/2;i++){
            for(let j=0;j<16;j++){
                expect(mixRes[j*len + i]).toBeCloseTo(.001*(j+1),5)
            }
            expect(stagingRes[i]).toBeCloseTo(17 *.001,5);
        }
        for(let i=3*BUFFER_SIZE/2;i<2*BUFFER_SIZE;i++){
            expect(stagingRes[i]).toBe(0);
            expect(mixRes[i]).toBe(0);
        }
    });

    it('should zero-fill the remainder of a block when a region ends mid-block', () => {
        ; // 1 full block + 1 sample
        const staging = [[1, 129]];
        const mix = [[]];

        const timeline = createTimelineObject(staging, mix, { start: 0, end: BUFFER_SIZE });
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = BUFFER_SIZE;
        
        const { stagingRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, BUFFER_SIZE);

        expect(stagingRes[0]).toBe(0);
        for(let i=1;i<129;i++){
            expect(stagingRes[i]).toBeCloseTo(.001,5);
        }
        expect(stagingRes[129]).toBe(0);
    });

    it('should wrap around correctly when looping is enabled', () => {
        const timelineEnd = 100;
        const staging = [[10, 20]]; // Region at the very start
        const mix = [[[10,20]]];

        const timeline = createTimelineObject(staging, mix, { start: 0, end: timelineEnd });
        timeline.pos.staging = 95;
        timeline.pos.mix = 95;
        
        const audioData = getAudioData(timeline);
        const bounceEntries = getBounceEntries(timeline, audioData);
        const simSamples = 300;

        // Run for 128 samples. Should see 50 samples of silence, then 78 samples of the start
        const { stagingRes, mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, true, simSamples);

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

        const { stagingRes,mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, simSamples);

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

        const { stagingRes,mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, simSamples);

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

        const { stagingRes,mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, simSamples);

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

        const { stagingRes,mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, simSamples);

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

        const { mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, simSamples);

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

        const { mixRes } = runSimulation(timeline, stagingPtrs, mixPtrs, buffers, bounceEntries, false, simSamples);

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
