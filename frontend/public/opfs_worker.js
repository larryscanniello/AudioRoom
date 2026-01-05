

buffers = {
    staging: null,
    mix: null,
    record: null,
}

pointers = {
    staging: {
        read: null,
        write: null,
        isFull: null,
    },
    mix: {
        read: null,
        write: null,
        isFull: null,
    },
    record: {
        read: null,
        write: null,
        isFull: null,
    }
}

opfs = {
    root: null,
    tracks: [],
    mixes: [],
    recordHandle: null,
}

curr = {
    track: 0,
    take: 0,
    sample: {
        staging: 0,
        mix: 0,
    }
}

timeline = {
    timeline: null,
    start: null,
    end: null,
    length: null,
}

let looping = false;

intervalIds = {
    record: null,
    staging: null,
    mix: null
}

const PLAYBACK_BUFFER_SIZE = 48000 * 10;

self.onmessage = (e) => {
    if(e.data.type === "init"){
        const init = async () => {
            root = await navigator.storage.getDirectory();    
            const currDir = await root.getDirectoryHandle(`track_${currTrack}`,{create:true});
            tracks.push({dirHandle:currDir,takeHandles:[]});
            Object.assign(buffers,{
                staging: new Float32Array(e.data.stagingPlaybackSAB,9),
                mix: new Float32Array(e.data.mixPlaybackSAB,9),
                record: new Float32Array(e.data.recordSAB,9),
            })
            Object.assign(pointers,{
                staging:{
                    read: new Uint32Array(e.data.stagingPlaybackSAB,0,1),
                    write: new Uint32Array(e.data.stagingPlaybackSAB,4,1),
                    isFull: new Uint8Array(e.data.stagingPlaybackSAB,8,1)
                },
                mix:{
                    read: new Uint32Array(e.data.mixPlaybackSAB,0,1),
                    write: new Uint32Array(e.data.mixPlaybackSAB,4,1),
                    isFull: new Uint8Array(e.data.mixPlaybackSAB,8,1),
                },
                record:{
                    read: new Uint32Array(e.data.recordSAB,0,1),
                    write: new Uint32Array(e.data.recordSAB,4,1),
                    isFull: new Uint8Array(e.data.recordSAB,8,1),
                }
            })
        }
        init();
    }
    if(e.data.type === "init_recording"){
        const init_recording = async () => {
            const currFile = await tracks[currTrack].dirHandle.getFileHandle(`take_${currTake}`,{create:true});
            tracks[currTrack].takeHandles.push(currFile);
            recordHandle = tracks[currTrack].takeHandles[-1];
            timeline = e.data.timeline;
            timelineStart = Math.floor(e.data.timelineStart * 48000); //convert to samples
            currMixPlaybackSample = timelineStart;
            timelineEnd = e.data.timelineEnd ? Math.floor(e.data.timelineEnd * 48000) : null;
            looping = e.data.looping
            currMixPlaybackSample = timelineStart;
            timelineLength = timelineEnd - timelineStart;
            writeToOPFSInterval = setInterval(()=>writeToOPFS(),19);
            mixPlaybackInterval = setInterval(()=>fillMixPlaybackBuffer(),10);
        }
        init_recording();
    }
    if(e.data.type === "init_playback"){
        const init_playback = async () => {
            
        }
    }
    if(e.data.type === "stop_recording"){
        currTake++;
        clearInterval(writeToOPFSInterval);
        clearInterval(mixPlaybackInterval);
    }
    if(e.data.type === "new_bounce"){

    }
    if(e.data.type === "fill_mix_playback_buffer"){
        fillMixPlaybackBuffer();
    }
    if(e.data.type === "fill_staging_playback_buffer"){
        fillStagingPlaybackBuffer();
    }

    if(e.data.type === "read"){

    }
}




function writeToRingBuffer(samplesToFill, fillCallback,handle) {
    let samplesWritten = 0;
    while (samplesWritten < samplesToFill) {
        const currentPtr = Atomics.load(stagingPlaybackWritePtr, 0);
        const remainingInPhysicalBuffer = PLAYBACK_BUFFER_SIZE - currentPtr;
        const chunkLength = Math.min(totalSamples - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = PlaybackView.subarray(currentPtr, currentPtr + chunkLength);
        handle.read(chunkView, { at: samplesWritten });
        const nextPtr = (currentPtr + chunkLength) % PLAYBACK_BUFFER_SIZE;
        Atomics.store(stagingPlaybackWritePtr, 0, nextPtr);
        samplesWritten += chunkLength;
    }
}

function writeToOPFS(){
    const readPtr = Atomics.load(recordReadPtr,0);
    const writePtr = Atomics.load(recordWritePtr,0);
    const recordBufferIsFull = Atomics.load(recordBufferIsFull,0);
    let samplesToWrite = (writePtr - readPtr + recordBuffer.length) % recordBuffer.length;
    if(recordBufferIsFull){samplesToWrite = recordBuffer.length;}
    if(samplesToWrite===0){return;}
    while(samplesToWrite > 0){
        const sliceLength = Math.min(samplesToWrite,recordBuffer.length - writePtr);
        recordHandle.write(recordBuffer.subarray(writePtr,writePtr+sliceLength),{at:recordHandle.getSize()})
        writePtr = (writePtr + sliceLength) % recordBuffer.length;
        samplesToWrite -= sliceLength;
    }
    Atomics.store(recordWritePtr,0,writePtr);
}


function fillMixPlaybackBuffer(){
    const writePtr = Atomics.load(mixPlaybackWritePtr,0);
    const mixBufferIsFull = Atomics.load(mixBufferIsFull,0);
    const available = (writePtr - readPtr + mixPlaybackBuffer.length) % mixPlaybackBuffer.length;
    if(mixBufferIsFull) return;
    let samplesToFill = available;
    while(samplesToFill>0){
        const sliceEnd = timelineEnd;
        const sliceLength = Math.min(samplesToFill,timelineEnd - currMixPlaybackSample);
        if(sliceLength<=0) break;
        writeToRingBuffer(sliceLength,(view,offset)=>{
            masters[-1].read(view, { at: offset });
        })
        currMixPlaybackSample += sliceLength;
        if(looping && currMixPlaybackSample >= timelineEnd){
            currMixPlaybackSample = timelineStart;
        }else if(!looping && currMixPlaybackSample >= timelineEnd){
            break;
        }
    }   

}

function fillStagingPlaybackBuffer(){
    const writePtr = Atomics.load(stagingPlaybackWritePtr, 0);
    const stagingBufferIsFull = Atomics.load(stagingPlaybackBufferIsFull,0);
    const available = (writePtr - readPtr + stagingPlaybackBuffer.length) % stagingPlaybackBuffer.length;

    if(isFull) return;
    let samplesLeftToFill = available;
    while(samplesLeftToFill > 0){
        const take = timeline[-1].find(t => t.timelineEnd > currPlaybackSample);
        const sliceEnd = take ? Math.min(take.timelineEnd, timelineEnd) : timelineEnd;
        const sliceLength = Math.min(samplesLeftToFill, sliceEnd - currPlaybackSample);
        if (sliceLength <= 0) break; 
        if (take && currPlaybackSample >= take.timelineStart) {
            // CASE: Fill from Take
            writeToRingBuffer(sliceLength, (view,offset) => {
                const handle = tracks[currTrack].takeHandles[take.fileName];
                handle.read(view, { at: offset });
            });
        } else {
            // CASE: Fill Silence (either leading silence or gap after timeline)
            const silenceLen = take ? Math.min(sliceLength, take.timelineStart - currPlaybackSample) : sliceLength;
            writeToRingBuffer(silenceLen, (view) => view.fill(0));
        }

        // Advance timeline position
        currPlaybackSample += sliceLength;
        samplesLeftToFill -= sliceLength;

        // Handle Looping
        if (looping && currStagingPlaybackSample >= timelineEnd) {
            currStagingPlaybackSample = timelineStart;
        } else if (!looping && currStagingPlaybackSample >= timelineEnd) {
            break;
        }
    }

    Atomics.store(isFull,0,1);
    
}