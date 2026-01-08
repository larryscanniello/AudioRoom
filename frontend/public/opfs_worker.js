const buffers = {
    staging: null,
    mix: null,
    record: null,
}

const pointers = {
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

const opfs = {
    root: null,
    tracks: [],
    mixes: [],
    recordHandle: null,
}

const curr = {
    track: 0,
    take: 0,
    sample: {
        staging: 0,
        mix: 0,
    }
}

const timeline = {
    timeline: null,
    start: null,
    end: null,
    length: null,
}

let looping = false;

const intervalIds = {
    record: null,
    staging: null,
    mix: null
}

const tracks = [];

const PLAYBACK_BUFFER_SIZE = 48000 * 10;

self.onmessage = (e) => {
    console.log('opfs received message');
    if(e.data.type === "init"){
        console.log('opfs worker inited');
        const init = async () => {
            const root = await navigator.storage.getDirectory();    
            const currDir = await root.getDirectoryHandle(`track_${curr.track}`,{create:true});
            tracks.push({dirHandle:currDir,takeHandles:[]});
            Object.assign(buffers,{
                staging: new Float32Array(e.data.stagingPlaybackSAB,12),
                mix: new Float32Array(e.data.mixPlaybackSAB,12),
                record: new Float32Array(e.data.recordSAB,12),
            })
            Object.assign(pointers,{
                staging:{
                    read: new Uint32Array(e.data.stagingPlaybackSAB,0,1),
                    write: new Uint32Array(e.data.stagingPlaybackSAB,4,1),
                    isFull: new Uint32Array(e.data.stagingPlaybackSAB,8,1)
                },
                mix:{
                    read: new Uint32Array(e.data.mixPlaybackSAB,0,1),
                    write: new Uint32Array(e.data.mixPlaybackSAB,4,1),
                    isFull: new Uint32Array(e.data.mixPlaybackSAB,8,1),
                },
                record:{
                    read: new Uint32Array(e.data.recordSAB,0,1),
                    write: new Uint32Array(e.data.recordSAB,4,1),
                    isFull: new Uint32Array(e.data.recordSAB,8,1),
                }
            })
        }
        init();
    }
    if(e.data.type === "init_recording"){
        const init_recording = async () => {
            console.log('tocreatesah',tracks,tracks[curr.track],tracks[curr.track].dirHandle);
            const currTakeFile = await tracks[curr.track].dirHandle.getFileHandle(`track_${curr.track}_take_${curr.take}`,{create:true});
            const currTakeHandle = await currTakeFile.createSyncAccessHandle();
            tracks[curr.track].takeHandles.push(currTakeHandle);
            timeline.timeline = e.data.timeline;
            timeline.start = Math.floor(e.data.timelineStart * 48000); //convert to samples
            curr.sample.mix = timeline.start;
            timeline.end = e.data.timelineEnd ? Math.floor(e.data.timelineEnd * 48000) : null;
            looping = e.data.looping;
            timeline.length = timeline.start - timeline.end;
            intervalIds.record = setInterval(()=>writeToOPFS(),19);
            intervalIds.mix = setInterval(()=>fillMixPlaybackBuffer(),10);
        }
        init_recording();
    }
    if(e.data.type === "init_playback"){
        const init_playback = async () => {
            
        }
    }
    if(e.data.type === "stop_recording"){
        curr.take++;
        clearInterval(intervalIds.record);
        clearInterval(intervalIds.mix);
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
    if(e.data.type === "get_waveform_array_to_render"){
        console.log('inside get waveform arr')
        const timeline = e.data.timeline;
        const bigArr = new Float32Array(timeline[timeline.length-1].timelineEnd);
        for(const take of timeline){
            const slice = bigArr.subarray(take.timelineStart,take.timelineEnd);
            console.log('getwaveform',tracks[curr.track].takeHandles);
            tracks[curr.track].takeHandles[take.takeNumber].read(slice,{at:0});
        }
        let max = 0;
        for(let i=0;i<bigArr.length;i++){
            max = Math.max(0,bigArr[i]);
        }
        console.log('max',max);
        postMessage({bigArr},[bigArr.buffer]);
    }
}




function writeToRingBuffer(samplesToFill, fillCallback,handle) {
    console.log('opfs: writeToRingBuffer');
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
    let readPtr = Atomics.load(pointers.record.read,0);
    const writePtr = Atomics.load(pointers.record.write,0);
    const isFull = Atomics.load(pointers.record.isFull,0);
    let samplesToWrite = (writePtr - readPtr + buffers.record.length) % buffers.record.length;
    if(isFull){samplesToWrite = buffers.record.length;}
    if(samplesToWrite===0){return;}
    while(samplesToWrite > 0){
        const sliceLength = Math.min(samplesToWrite,buffers.record.length - writePtr);
        const handle = tracks[curr.track].takeHandles[curr.take];
        const subarray = buffers.record.subarray(readPtr,readPtr+sliceLength);
        handle.write(subarray,{at:handle.getSize()})
        let isNonZero = false;
        for(let i=0;i<subarray.length;i++){
          if(subarray[i]!==0){isNonZero=true;}
        }
        console.log('isNonZero',isNonZero);
        readPtr = (readPtr + sliceLength) % buffers.record.length;
        samplesToWrite -= sliceLength;
    }
    Atomics.store(pointers.record.read,0,readPtr);
    Atomics.store(pointers.record.isFull,0,0);
}


function fillMixPlaybackBuffer(){
    return;
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
    const isFull = Atomics.load(pointers.staging.isFull,0);
    if(isFull) return;
    let writePtr = Atomics.load(pointers.staging.write, 0);
    let readPtr = Atomics.load(pointers.staging.read,0);
    let samplesLeftToFill = (readPtr - writePtr + buffers.staging.length) % buffers.staging.length;
    while(samplesLeftToFill > 0){
        const take = timeline.length > 0 ? timeline[timeline.length-1].find(t => t.timelineEnd > currPlaybackSample) : null;
        const sliceEnd = take ? Math.min(take.timelineEnd, timelineEnd) : timelineEnd;
        const sliceLength = Math.min(samplesLeftToFill, sliceEnd - currPlaybackSample);
        if (sliceLength <= 0) break; 
        const handle = tracks[curr.track].takeHandles[take.takeNumber];
        if (take && currPlaybackSample >= take.timelineStart) {
            // CASE: Fill from Take
            writeToRingBuffer(sliceLength, handle);
        } else {
            // CASE: Fill Silence (either leading silence or gap after timeline)
            const silenceLen = take ? Math.min(sliceLength, take.timelineStart - currPlaybackSample) : sliceLength;
            writeToRingBuffer(silenceLen, handle);
        // Advance timeline position
        curr.sample.staging += sliceLength;
        samplesLeftToFill -= sliceLength;
        }
        // Handle Looping
        if (looping && curr.sample.staging === timelineEnd) {
            curr.sample.staging = timelineStart;
        } else if (!looping && curr.sample.staging === timelineEnd) {
            break;
        }

        writePtr = (writePtr + sliceLength) % buffers.staging.length;
    }
    Atomics.store(pointers.staging.isFull,0,1);
    Atomics.store(pointers.staging.write,0,writePtr);
}