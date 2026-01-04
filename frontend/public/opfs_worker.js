import { read } from "fs";

let root = null;
let currTrack = 0;
let currTake = 0;
let currsample = 0;
let timeline = null;
let timelineStart = null;
let timelineEnd = null;
let timelineLength = null;
let loop = false;
let playbackBuffer = null;
let playbackReadPtr = null;
let playbackWritePtr = null;
let playbackBufferIsFull = null;
let currPlaybackSample = 0;
const PLAYBACK_BUFFER_SIZE = 48000 * 10;
const tracks = [];
const masters = [];

self.onmessage = (e) => {
    if(e.data.type === "init"){
        const init = async () => {
            root = await navigator.storage.getDirectory();    
            const currDir = await root.getDirectoryHandle("track_0",{create:true});
            tracks.push({dirHandle:currDir,takeHandles:[]});
            playbackBuffer = new Float32Array(e.data.playbackSAB,9);
            playbackReadPtr = new Uint32Array(e.data.playbackSAB,0,1);
            playbackWritePtr = new Uint32Array(e.data.playbackSAB,4,1);
            playbackBufferIsFull = new Uint8Array(e.data.playbackSAB,8,1);

        }
        init();
    }
    if(e.data.type === "init_recording"){
        const init_recording = async () => {
            const currFile = await tracks[currTrack].dirHandle.getFileHandle(`take_${currTake}`,{create:true});
            tracks[currTrack].takeHandles.push(currFile);
            timeline = e.data.timeline;
            timelineStart = Math.floor(e.data.timelineStart * 48000); //convert to samples
            currPlaybackSample = timelineStart;
            timelineEnd = e.data.timelineEnd ? Math.floor(e.data.timelineEnd * 48000) : null;
            looping = e.data.looping
            currPlaybackSample = timelineStart;
            timelineLength = timelineEnd - timelineStart
            //fill buffer

        }
        init_recording();
    }
    if(e.data.type === "stop_recording"){
        currTake++;
    }
    if(e.data.type === "new_bounce"){

    }
    if(e.data.type === "fill_playback_buffer"){
        const writePtr = Atomics.load(playbackWritePtr, 0);
        const readPtr = Atomics.load(playbackReadPtr, 0);
        
        const samplesToWrite  = Math.min(available, 256);
        if(samplesToWrite === 0) return;
        
        
    }

    if(e.data.type === "read"){

    }
}

function fillStagingPlaybackBuffer(){
    const writePtr = Atomics.load(playbackWritePtr, 0);
    const readPtr = Atomics.load(playbackReadPtr, 0);
    const isFull = Atomics.load(playbackBufferIsFull,0);
    const available = (writePtr - readPtr + playbackBuffer.length) % playbackBuffer.length;

    if(isFull) return;
    let samplesLeftToFill = available;
    do{
        let currtake;
        for(const [index,take] of timeline[-1].entries()){
            if(samplesLeftToFill<=0) break;
            if(take.timelineEnd < currPlaybackSample){
                continue
            }
            const endSample = Math.min(timelineEnd,take.timelineEnd);
            if(take.timelineStart > currPlaybackSample){
                const silenceToFill = Math.min(samplesLeftToFill,Math.max(0,endSample-currPlaybackSample));
                const silenceToCopyAtEndOfRingBuffer = Math.min(samplesLeftToFill,PLAYBACK_BUFFER_SIZE - readPtr[0]);
                const silenceToCopyAtBeginningOfRingBuffer = Math.max(0,silenceToFill - (PLAYBACK_BUFFER_SIZE - readPtr[0]))
                playbackBuffer.fill(0,readPtr[0],readPtr[0] + silenceToCopyAtEndOfRingBuffer);
                playbackBuffer.fill(0,0,silenceToCopyAtBeginningOfRingBuffer);
                samplesLeftToFill -= silenceToFill;
                readPtr[0] = (readPtr[0] + silenceToFill) % PLAYBACK_BUFFER_SIZE;
                currPlaybackSample += silenceToFill;
                if(looping && currPlaybackSample === timelineEnd){
                    currPlaybackSample = timelineStart;
                    break; // repeat the timeline loop from the beginning
                }
            }
            //the next block may start copy a take from the beginning, after silence, or in the middle of a take
            if(samplesLeftToFill > 0){
                const takeSamplesLeft = endSample - currPlaybackSample;
                const samplesToFillFromThisTake = Math.min(samplesLeftToFill,takeSamplesLeft);
                const takeSamplesToCopyAtEndOfRingBuffer = Math.min(samplesLeftToFill,PLAYBACK_BUFFER_SIZE - readPtr[0]);
                const takeSamplesToCopyAtBeginningOfRingBuffer = Math.max(0,samplesToFillFromThisTake - (PLAYBACK_BUFFER_SIZE - readPtr[0]));
                const handle = tracks[currTrack].takeHandles[take.fileName]
                const sabEndView = new Float32Array(playbackBuffer,readPtr[0],takeSamplesToCopyAtEndOfRingBuffer);
                handle.read(sabEndView,{at:currPlaybackSample});
                currPlaybackSample += takeSamplesToCopyAtEndOfRingBuffer;
                readPtr[0] = (readPtr[0] + takeSamplesToCopyAtEndOfRingBuffer) % PLAYBACK_BUFFER_SIZE; 
                if(looping && currPlaybackSample === timelineEnd){
                    currPlaybackSample = timelineStart;
                    break; // repeat the timeline loop from the beginning
                }
                const sabBeginningView = new Float32Array(playbackBuffer,0,takeSamplesToCopyAtBeginningOfRingBuffer);
                handle.read(sabBeginningView,{at:currPlaybackSample});
                currPlaybackSample += takeSamplesToCopyAtBeginningOfRingBuffer;
                readPtr[0] = (readPtr[0] + samplesToFillFromThisTake) % PLAYBACK_BUFFER_SIZE;
                if(looping && currPlaybackSample === timelineEnd){
                    currPlaybackSample = timelineStart;
                    break; // repeat the timeline loop from the beginning
                }
                
            }
        }
        //in case we are past the last take but need to output silence
        if(samplesLeftToFill>0){
            const silenceToFill = Math.min(samplesLeftToFill,Math.max(0,timelineEnd-currPlaybackSample));
            const silenceToCopyAtEndOfRingBuffer = Math.min(samplesLeftToFill,PLAYBACK_BUFFER_SIZE - readPtr[0]);
            const silenceToCopyAtBeginningOfRingBuffer = Math.max(0,silenceToFill - (PLAYBACK_BUFFER_SIZE - readPtr[0]))
            playbackBuffer.fill(0,readPtr[0],readPtr[0] + silenceToCopyAtEndOfRingBuffer);
            playbackBuffer.fill(0,0,silenceToCopyAtBeginningOfRingBuffer);
            samplesLeftToFill -= silenceToFill;
            readPtr[0] = (readPtr[0] + silenceToFill) % PLAYBACK_BUFFER_SIZE;
            currPlaybackSample += silenceToFill;
        }
    }while(looping && samplesLeftToFill>0)
}