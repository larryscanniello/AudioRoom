import type {
	TrackEntry,
	TimelineState,
    Region,
} from "./types";

export function fillPlaybackBufferUtil(
    buffer:Float32Array,
    TRACK_COUNT:number,
    writePtr:number,
    readPtr:number,
    timeline: TimelineState,
    tracks: TrackEntry[],
    looping:boolean,
): {newWritePtr:number,timelinePos:number} {
    const trackBufferLen = buffer.length/TRACK_COUNT
    const available = writePtr === readPtr ? trackBufferLen : (readPtr - writePtr + trackBufferLen) % (trackBufferLen);
    let timelinePos:number = timeline.pos.mix;
    let writePtrPerTrack = writePtr;
    for(let track=0;track<timeline.mix.length;track++){
        let samplesToFill = available;
        writePtrPerTrack = writePtr;
        const length = timeline.mix[track].length;
        timelinePos = timeline.pos.mix
        while(samplesToFill>0){
            const region = length > 0 ? timeline.mix[track].find((reg:Region) => reg.end > timelinePos) : null;
            const sliceEnd = region ? Math.min(region.end, timeline.end) : timeline.end;
            let sliceLength = Math.min(samplesToFill, sliceEnd - timelinePos,trackBufferLen - writePtrPerTrack);
            if (sliceLength < 0) break; 
            if (region && timelinePos >= region.start && timelinePos < timeline.end) {
                // CASE: Fill from Take
                if(track >= tracks.length || !(region.name in tracks[track].takeHandles)){
                    writePtrPerTrack = writeSilenceToRingBuffer(sliceLength,writePtrPerTrack,track,buffer,TRACK_COUNT)
                    console.error('Error writing to ring buffer');
                }else{
                    const handle = tracks[track].takeHandles[region.name];
                    writePtrPerTrack = writeToRingBuffer(
                        sliceLength, 
                        handle,
                        region.start,
                        writePtrPerTrack,
                        track,
                        timelinePos,
                        buffer,
                        TRACK_COUNT,
                        region.offset
                    );
                }
                
            } else {
                // CASE: Fill Silence (either leading silence or gap after timeline)
                sliceLength = region ? Math.min(sliceLength, region.start - timelinePos) : sliceLength;
                writePtrPerTrack = writeSilenceToRingBuffer(sliceLength,writePtrPerTrack,track,buffer,TRACK_COUNT);
            }
            // Advance timeline position
            timelinePos += sliceLength;
            samplesToFill -= sliceLength;
            
            // Handle Looping
            if (looping && timelinePos >= timeline.end){
                timelinePos = timeline.start;
            }else if(timelinePos >= timeline.end){
                break;
            }
            }
    }
    const newWritePtr = (writePtr+available)%trackBufferLen
    
    return {newWritePtr,timelinePos};
}

function writeToRingBuffer(
    samplesToFill:number, 
    handle: any, 
    takeStart:number, 
    write:number, 
    track:number, 
    pos:number,
    buffer:Float32Array,
    TRACK_COUNT:number,
    offset:number,
):number{
    let writePtr = write;
    let samplesWritten = 0;
    let timelinePos = pos;
    const trackBufferLen = buffer.length / TRACK_COUNT;
    while (samplesWritten < samplesToFill) {
        const remainingInPhysicalBuffer = trackBufferLen - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffer.subarray(track * trackBufferLen + writePtr, track * trackBufferLen + writePtr + chunkLength);
        handle.read(chunkView, { at: (timelinePos - takeStart + offset) * Float32Array.BYTES_PER_ELEMENT });  
        writePtr = (writePtr + chunkLength) % trackBufferLen;
        samplesWritten += chunkLength;
        timelinePos += chunkLength;
    }
    
    return writePtr;
}

function writeSilenceToRingBuffer(
    samplesToFill:number,
    write:number,
    track:number,
    buffer:Float32Array,
    TRACK_COUNT:number,
):number{
    let writePtr = write;
    let samplesWritten = 0;
    const trackBufferLen = buffer.length / TRACK_COUNT;
    while(samplesWritten < samplesToFill){
        const remainingInPhysicalBuffer = trackBufferLen - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffer.subarray(track * trackBufferLen + writePtr, track * trackBufferLen + writePtr + chunkLength);
        chunkView.fill(0);      
        writePtr = (writePtr + chunkLength) % trackBufferLen;
        samplesWritten += chunkLength;
    }
    
    return writePtr;
}