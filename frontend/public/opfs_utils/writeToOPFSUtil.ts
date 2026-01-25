export function writeToOPFSUtil(
    samplesToWrite:number,
    buffer:Float32Array,
    readPtr:number,
    writePtr:number,
    handle: any,
):number{
    let newReadPtr = readPtr;
    while(samplesToWrite > 0){
        const sliceLength = Math.min(samplesToWrite,buffer.length - newReadPtr);
        const subarray = buffer.subarray(newReadPtr,newReadPtr+sliceLength);
        handle.write(subarray,{at:handle.getSize()})
        newReadPtr = (newReadPtr + sliceLength) % buffer.length;
        samplesToWrite -= sliceLength;
    }
    return newReadPtr;
}