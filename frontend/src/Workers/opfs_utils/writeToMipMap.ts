import { CONSTANTS } from "../../Constants/constants";
import type {Region,BounceEntry} from "./types"

export function writeToMipMap(
    startSample: number,
    endSample: number,
    timelines:readonly Region[][],
    totalTimelineSamples:number,
    resolutions:number[],
    buffer: Float32Array,
    mipMap: Int8Array,
    tracks: BounceEntry[],
){
    const iterateAmount = totalTimelineSamples / resolutions[0];
    const TRACK_COUNT = timelines.length;
    const halfLength = CONSTANTS.MIPMAP_HALF_SIZE;
    const MIPMAP_BUFFER_SIZE_PER_TRACK = Math.floor(buffer.length / TRACK_COUNT);
    let currBucket = 0;
    let bufferIndex = Math.floor(buffer.length / TRACK_COUNT);
    let max = -1;
    let min = 1;
    buffer.fill(0);
    let startBucket = Math.floor(startSample / iterateAmount);
    let iterateAmountMultiple = startBucket * iterateAmount;
    currBucket = startBucket;
    //generate the combined (summed) waveform, and then take mins / maxes and put into buckets
    for(let i=startSample;i<endSample;i++){
        if(bufferIndex >= buffer.length/TRACK_COUNT){
            const readToEnd = Math.min(endSample,i+MIPMAP_BUFFER_SIZE_PER_TRACK)
            readTo(i,readToEnd,timelines,buffer,tracks)
            bufferIndex = 0;
        }
        if(i >= iterateAmountMultiple){
            iterateAmountMultiple += iterateAmount;
            mipMap[currBucket] = Math.max(-128, Math.min(127, Math.round(max * 127)));
            mipMap[halfLength + currBucket] = Math.max(-128, Math.min(127, Math.round(min * 127)));
            currBucket += 1;
            min = 1; max = -1;
        }
        let currSample = 0;
        for(let b=0;b<TRACK_COUNT;b++){
            const toAdd =  buffer[b*MIPMAP_BUFFER_SIZE_PER_TRACK + bufferIndex];
            currSample += toAdd;
        }
        max = Math.max(max,currSample);
        min = Math.min(min,currSample);
        bufferIndex += 1;
    }
    let count = 1;
    
    while(count < resolutions.length){
        const currLevel = resolutions.slice(0,count).reduce((acc, curr) => acc + curr, 0);
        let highStart = currLevel + Math.floor(startBucket/2**count);
        let highEnd = currLevel + Math.ceil(currBucket/2**count);
        let lowIndex = (highStart - currLevel)*2 + resolutions.slice(0,count-1).reduce((acc,curr) => acc + curr,0);
        for(let j=highStart;j<highEnd;j++){
            const maxOption1 = mipMap[lowIndex];
            const maxOption2 = mipMap[lowIndex+1];
            mipMap[j] = Math.max(maxOption1,maxOption2);
            const minOption1 = mipMap[halfLength + lowIndex];
            const minOption2 = mipMap[halfLength + lowIndex + 1];
            mipMap[j + halfLength] = Math.min(minOption1,minOption2);
            lowIndex += 2;
        }
        count += 1;
    }    
}


function readTo(
    startSample:number,
    endSample:number,
    timelines: readonly Region[][],
    buffer: Float32Array,
    tracks: BounceEntry[],
){
        const MIPMAP_BUFFER_SIZE_PER_TRACK = Math.floor(buffer.length/timelines.length)
        for(let i=0;i<timelines.length;i++){
            let currPos = startSample;
            
            const currTimeline = timelines[i];
            let bufferPos = i * MIPMAP_BUFFER_SIZE_PER_TRACK;
            const bufferEndPos = bufferPos + (endSample - startSample);
            while(currPos < endSample){
                const region = currTimeline.find(r => r.end > currPos);
                if(!region){
                    buffer.subarray(bufferPos,bufferEndPos).fill(0);
                    currPos = endSample; //0
                }else if(region.start > currPos){
                    const toFill = Math.min(region.start-currPos,bufferEndPos-bufferPos);
                    buffer.subarray(bufferPos,bufferPos+toFill).fill(0);
                    currPos += toFill;
                    bufferPos += toFill;
                }else{
                    const toFill = Math.min(region.end - currPos,bufferEndPos-bufferPos);
                    const subarray = buffer.subarray(bufferPos,bufferPos+toFill);
                    tracks[region.bounce].takeHandles[region.name].read(subarray,{at:(currPos-region.start)*Float32Array.BYTES_PER_ELEMENT});
                    currPos += toFill;
                    bufferPos += toFill;
                }
            }
        }
    }