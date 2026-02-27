import type { MipMapManager } from "./MipMapManager";

export function writeToOPFSUtil(
    samplesToWrite:number,
    buffer:Float32Array,
    readPtr:number,
    handle: any,
    mipMapManager: MipMapManager|null,
    timelineStartSample: number,
):number{
    let newReadPtr = readPtr;
    while(samplesToWrite > 0){
        const sliceLength = Math.min(samplesToWrite,buffer.length - newReadPtr);
        const subarray = buffer.subarray(newReadPtr,newReadPtr+sliceLength);
        handle.write(subarray,{at:handle.getSize()})
        const fileSizeInSamples = handle.getSize() / Float32Array.BYTES_PER_ELEMENT;
        mipMapManager && mipMapManager.write(
            {
                startSample: timelineStartSample + fileSizeInSamples - subarray.length,
                endSample: timelineStartSample + fileSizeInSamples,
            },
            [],[], 
            "staging",
            subarray
        )
        newReadPtr = (newReadPtr + sliceLength) % buffer.length;
        samplesToWrite -= sliceLength;
    }
    return newReadPtr;
}