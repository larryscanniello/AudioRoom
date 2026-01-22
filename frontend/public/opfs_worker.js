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
    sessionDir: null,
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
    staging: [],
    mix: [],
    start: null,
    end: null,
    pos: {
        staging: 0,
        mix: 0,
    },
}

const mipMap = {
    staging: null,
    mix: null,
    halfLength: null,
    resolutions: null,
    subBuffer: null,
}
let looping = false;

const proceed = {
    record: null,
    staging: null,
    mix: null
}

const tracks = [];

let TRACK_COUNT;
let MIX_MIPMAP_BUFFER_SIZE_PER_TRACK;
let MIX_BUFFER_SIZE;

async function listFiles(dir,dirstr) {
    let root;
    if(!dir){
        root = await navigator.storage.getDirectory();
    }else{root=dir;}
    console.log('listFiles',root);
    for await (let [name, handle] of root) {
        if (handle.kind === 'file') {
        const file = await handle.getFile();
        console.log(`File: ${dirstr}${name} | Size: ${file.size} bytes`);
        } else {
        console.log(`Dir: ${dirstr+name}/`)
        listFiles(handle,dirstr+name+'/');
        }
    }
}

async function closeHandles(dir){
    let root;
    if(!dir){
        root = await navigator.storage.getDirectory();
    }else{root=dir;}
    for await (let [name,handle] of root) {
        if (handle.kind === 'file') {
        await handle.close();
        } else {
        await closeHandles(handle);
        }
    }
}

self.onmessage = (e) => {
    if(e.data.type === "init"){
        console.log('opfs worker inited');
        const init = async () => {
            await (await navigator.storage.getDirectory()).remove({recursive: true}); //delete all previous files in opfs
            const root = await navigator.storage.getDirectory();
            const uuid = crypto.randomUUID();
            const sessionDir = await root.getDirectoryHandle(`session_${uuid}`,{create:true});
            opfs.sessionDir = sessionDir;
            const currDir = await sessionDir.getDirectoryHandle(`track_${curr.track}`,{create:true});
            tracks.push({dirHandle:currDir,takeHandles:[]});
            MIX_MIPMAP_BUFFER_SIZE_PER_TRACK = e.data.MIX_MIPMAP_BUFFER_SIZE_PER_TRACK;
            MIX_BUFFER_SIZE = e.data.MIX_BUFFER_SIZE;
            TRACK_COUNT = e.data.TRACK_COUNT;
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
            Object.assign(mipMap,{
                staging: new Int8Array(e.data.mipMap.staging,1),
                mix: new Int8Array(e.data.mipMap.mix,1),
                isWorking: {
                    staging: new Int8Array(e.data.mipMap.staging,0,1),
                    mix: new Int8Array(e.data.mipMap.mix,0,1),
                },
                halfSize: e.data.mipMap.MIPMAP_HALF_SIZE,
                resolutions: e.data.mipMap.MIPMAP_RESOLUTIONS,
                totalTimelineSamples:e.data.mipMap.TOTAL_TIMELINE_SAMPLES,
                buffer: new Float32Array(TRACK_COUNT * MIX_MIPMAP_BUFFER_SIZE_PER_TRACK),
            })
            
            opfs.root = root;
        }
        init();
    }
    if(e.data.type === "init_recording"){
        const init_recording = async () => {
            const currTakeFile = await tracks[curr.track].dirHandle.getFileHandle(`track_${curr.track}_take_${curr.take}`,{create:true});
            const currTakeHandle = await currTakeFile.createSyncAccessHandle();
            tracks[curr.track].takeHandles.push(currTakeHandle);
            const start = Math.round(e.data.timelineStart * 48000);
            const end = Math.round(e.data.timelineEnd * 48000);
            Object.assign(timeline,{
                staging: e.data.timeline.staging,
                mix: e.data.timeline.mix,
                start,
                end,
                pos: {
                    mix: start,
                    staging: start,
                },
                length: end-start,
            });
            looping = e.data.looping;
            Atomics.store(pointers.record.read,0,0);
            Atomics.store(pointers.record.write,0,0);
            Atomics.store(pointers.record.isFull,0,0);
            Atomics.store(pointers.mix.read,0,0);
            Atomics.store(pointers.mix.write,0,0);
            Atomics.store(pointers.mix.isFull,0,0);
            proceed.record = "ready";
            writeToOPFS();
            proceed.mix = "ready";
            fillMixPlaybackBuffer();
        }
        init_recording();
    }
    if(e.data.type === "init_playback"){
        const init_playback = async () => {
            Object.assign(timeline,{
                staging: e.data.timeline.staging,
                start: Math.round(e.data.timelineStart*48000),
                end: Math.round(e.data.timelineEnd * 48000),
                pos: {
                    staging: Math.round(48000*e.data.timelineStart),
                    mix: Math.round(48000*e.data.timelineStart),
                }
            });
            Atomics.store(pointers.staging.read,0,0);
            Atomics.store(pointers.staging.write,0,0);
            Atomics.store(pointers.staging.isFull,0,0);
            Atomics.store(pointers.mix.read,0,0);
            Atomics.store(pointers.mix.write,0,0);
            Atomics.store(pointers.mix.isFull,0,0);
            proceed.staging = "ready";
            fillStagingPlaybackBuffer();
            proceed.mix = "ready";
            fillMixPlaybackBuffer();
        }
        init_playback();
    }
    if(e.data.type === "stop_recording"){
        curr.take++;
        proceed.record = "off";
        proceed.mix = "off";
    }
    if(e.data.type === "stop_playback"){
        proceed.staging = "off";
        proceed.mix = "off";
    }
    if(e.data.type === "bounce_to_mix"){
        const mixTimelines = e.data.mixTimelines;
        timeline.mix = mixTimelines;
        writeToMixMipMap(mixTimelines);
        curr.track ++;
        curr.take = 0;
        const createNewTrack = async () => {
            const newTrack = await opfs.sessionDir.getDirectoryHandle(`track_${curr.track}`,{create:true});
            tracks.push({dirHandle:newTrack,takeHandles:[]});
        }
        createNewTrack();
    }
    if(e.data.type === "fill_staging_mipmap"){
        const newTake = e.data.newTake;
        writeToStagingMipMap("staging",newTake);
    }
    if(e.data.type === "cleanup"){
        tracks.forEach(track => {
            track.takeHandles.forEach(handle => handle.close());
        });
    }
}

function writeToMixMipMap(mixTimelines){
    //writes the whole mipmap
    const int8 = mipMap.mix;
    const halfLength = mipMap.halfSize;
    const resolutions = mipMap.resolutions;
    const iterateAmount = mipMap.totalTimelineSamples / resolutions[0];
    let iterateAmountMultiple = 0;
    let currBucket = 0;
    let bufferIndex = mipMap.buffer.length;
    let max = -1;
    let min = 1;
    let endSample = 0;
    mipMap.buffer.fill(0);
    for(let i=0;i<mixTimelines.length;i++){
        const currTimeline = mixTimelines[i];
        const len = currTimeline.length;
        if(len>0){
            endSample = Math.max(endSample,currTimeline[len-1].end);
        }
    }
    
    const readTo = (startSample,endSample) => {
        //mipMap.buffer.fill(0);
        for(let i=0;i<mixTimelines.length;i++){
            let currPos = startSample;
            const currTimeline = mixTimelines[i];
            let bufferPos = i * MIX_MIPMAP_BUFFER_SIZE_PER_TRACK;
            const bufferEndPos = bufferPos + (endSample - startSample);
            while(currPos < endSample){
                const region = currTimeline.find(r => r.end > currPos);
                if(!region){
                    mipMap.buffer.subarray(bufferPos,bufferEndPos).fill(0);
                    currPos = endSample; //0
                }else if(region.start > currPos){
                    const toFill = Math.min(region.start-currPos,bufferEndPos-bufferPos);
                    mipMap.buffer.subarray(bufferPos,bufferPos+toFill).fill(0);
                    currPos += toFill;
                    bufferPos += toFill;
                }else{
                    const toFill = Math.min(region.end - currPos,bufferEndPos-bufferPos);
                    const subarray = mipMap.buffer.subarray(bufferPos,bufferPos+toFill);
                    tracks[i].takeHandles[region.number].read(subarray,{at:(currPos-region.start)*Float32Array.BYTES_PER_ELEMENT});
                    currPos += toFill;
                    bufferPos += toFill;
                }
            }
        }
        
    }
    //generate the combined (summed) waveform, and then take mins / maxes and put into buckets
    for(let i=0;i<endSample;i++){
        if(bufferIndex >= mipMap.buffer.length/TRACK_COUNT){
            const readToEnd = Math.min(endSample,i+MIX_MIPMAP_BUFFER_SIZE_PER_TRACK)
            readTo(i,readToEnd)
            bufferIndex = 0;
        }
        if(i >= iterateAmountMultiple){
            iterateAmountMultiple += iterateAmount;
            int8[currBucket] = Math.max(-128, Math.min(127, Math.round(max * 127)));
            int8[halfLength + currBucket] = Math.max(-128, Math.min(127, Math.round(min * 127)));
            currBucket += 1;
            min = 1; max = -1;
        }
        let currSample = 0;
        for(let b=0;b<TRACK_COUNT;b++){
            const toAdd =  mipMap.buffer[b*MIX_MIPMAP_BUFFER_SIZE_PER_TRACK + bufferIndex];
            currSample += toAdd;
        }
        max = Math.max(max,currSample);
        min = Math.min(min,currSample);
        bufferIndex += 1;
    }
    let count = 1;
    while(count < mipMap.resolutions.length){
        let highStart = resolutions.slice(0,count).reduce((acc, curr) => acc + curr, 0);
        let highEnd = highStart + Math.ceil(currBucket/2**count);
        let lowIndex = resolutions.slice(0,count-1).reduce((acc,curr) => acc + curr,0);
        for(let j=highStart;j<highEnd;j++){
            const maxOption1 = int8[lowIndex];
            const maxOption2 = int8[lowIndex+1];
            int8[j] = Math.max(maxOption1,maxOption2);
            const minOption1 = int8[halfLength + lowIndex];
            const minOption2 = int8[halfLength + lowIndex + 1];
            int8[j + halfLength] = Math.min(minOption1,minOption2);
            lowIndex += 2;
        }
        count += 1;
    }
    Atomics.store(mipMap.isWorking.mix,0,1);
    postMessage({type:'mipmap_done'})
}

function writeToStagingMipMap(type,newTake){
    //only writes the new take to the mipmap
    const int8 = mipMap[type];
    const halfLength = mipMap.halfSize;
    const resolutions = mipMap.resolutions;
    const iterateAmount = mipMap.totalTimelineSamples / resolutions[0];
    let i=newTake.start;
    let startBucket = Math.floor(newTake.start / iterateAmount);
    let iterateAmountMultiple = startBucket * iterateAmount;
    let currBucket = startBucket;
    let max = -1; let min = 1;
    let bufferIndex = mipMap.buffer.length; // so that buffer fills up on first iteration
    let at = 0;
    let bufferIndexCount = 0;
    mipMap.buffer.fill(0);
    //fill the bottom layer of the pyramid of the mipmap
    //const reader = new Float32Array(tracks[curr.track].takeHandles[newTake.number].getSize());
    //tracks[curr.track].takeHandles[newTake.number].read(reader,{at:0});
    const handle = tracks[curr.track].takeHandles[newTake.number]
    while(i<newTake.end){
        if(bufferIndex >= mipMap.buffer.length){
            handle.read(mipMap.buffer,{at});
            bufferIndexCount += 1;
            at = bufferIndexCount * mipMap.buffer.length * Float32Array.BYTES_PER_ELEMENT;
            bufferIndex = 0;
        }
        if(i >= iterateAmountMultiple || i===newTake.end-1){
            iterateAmountMultiple += iterateAmount;
            int8[currBucket] = Math.max(-128, Math.min(127, Math.round(max * 127)));
            int8[halfLength + currBucket] = Math.max(-128, Math.min(127, Math.round(min * 127)));
            currBucket += 1;
            min = 1; max = -1;
        }
        max = Math.max(max,mipMap.buffer[bufferIndex]);
        min = Math.min(min,mipMap.buffer[bufferIndex])
        i += 1; bufferIndex += 1;
    } 
    //fill rest of the pyramid
    let count = 1;
    while(count < mipMap.resolutions.length){
        const currLevel = resolutions.slice(0,count).reduce((acc, curr) => acc + curr, 0);
        let highStart = currLevel + Math.floor(startBucket/2**count);
        let highEnd = currLevel + Math.ceil(currBucket/2**count);
        let lowIndex = (highStart - currLevel)*2 + resolutions.slice(0,count-1).reduce((acc,curr) => acc + curr,0);
        for(let j=highStart;j<highEnd;j++){
            const maxOption1 = int8[lowIndex];
            const maxOption2 = int8[lowIndex + 1];
            int8[j] = Math.max(maxOption1,maxOption2);
            const minOption1 = int8[halfLength + lowIndex];
            const minOption2 = int8[halfLength + lowIndex + 1];
            int8[j + halfLength] = Math.min(minOption1,minOption2);
            lowIndex += 2;
        }
        count += 1;
    }
    Atomics.store(mipMap.isWorking[type],0,1);
    postMessage({type:'mipmap_done'})
}




function writeToStagingRingBuffer(samplesToFill, handle, type, takeStart, writePtr) {
    let samplesWritten = 0;
    let timelinePos = timeline.pos.staging;
    while (samplesWritten < samplesToFill) {

        const remainingInPhysicalBuffer = buffers[type].length - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers[type].subarray(writePtr, writePtr + chunkLength);
        handle.read(chunkView, { at: (timelinePos - takeStart) * Float32Array.BYTES_PER_ELEMENT });  
        writePtr = (writePtr + chunkLength) % buffers[type].length;
        timelinePos += chunkLength;
        samplesWritten += chunkLength;
    }
    return writePtr;
}

function writeSilenceToStagingRingBuffer(samplesToFill,type,writePtr){
    let samplesWritten = 0;
    while(samplesWritten < samplesToFill){
        const remainingInPhysicalBuffer = buffers[type].length - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers[type].subarray(writePtr, writePtr + chunkLength);
        chunkView.fill(0);      
        writePtr = (writePtr + chunkLength) % buffers[type].length;
        samplesWritten += chunkLength;
    }
    return writePtr;
}

function writeToOPFS(){
    if(proceed.record!=="ready") return;
    proceed.record = "working";
    let readPtr = Atomics.load(pointers.record.read,0);
    const writePtr = Atomics.load(pointers.record.write,0);
    const isFull = Atomics.load(pointers.record.isFull,0);
    let samplesToWrite = (writePtr - readPtr + buffers.record.length) % buffers.record.length;
    if(isFull){samplesToWrite = buffers.record.length;}
    if(samplesToWrite===0){
        if(proceed.record!=="off"){
            proceed.record = "ready";
            setTimeout(()=>writeToOPFS(),15);
        }
        return;
    }
    while(samplesToWrite > 0){
        const sliceLength = Math.min(samplesToWrite,buffers.record.length - writePtr);
        const handle = tracks[curr.track].takeHandles[curr.take];
        const subarray = buffers.record.subarray(readPtr,readPtr+sliceLength);
        handle.write(subarray,{at:handle.getSize()})
        readPtr = (readPtr + sliceLength) % buffers.record.length;
        samplesToWrite -= sliceLength;
    }
    Atomics.store(pointers.record.read,0,readPtr);
    Atomics.store(pointers.record.isFull,0,0);
    if(proceed.record!=="off"){proceed.record = "ready";}
    setTimeout(()=>writeToOPFS(),15);
}

function writeToMixRingBuffer(samplesToFill, handle, takeStart, write, track, pos){
    let writePtr = write;
    let samplesWritten = 0;
    let timelinePos = pos;
    const trackBufferLen = buffers.mix.length / TRACK_COUNT;
    while (samplesWritten < samplesToFill) {
        const remainingInPhysicalBuffer = trackBufferLen - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers.mix.subarray(track * trackBufferLen + writePtr, track * trackBufferLen + writePtr + chunkLength);
        handle.read(chunkView, { at: (timelinePos - takeStart) * Float32Array.BYTES_PER_ELEMENT });  
        writePtr = (writePtr + chunkLength) % trackBufferLen;
        samplesWritten += chunkLength;
        timelinePos += chunkLength;
    }
    
    return writePtr;
}

function writeSilenceToMixRingBuffer(samplesToFill,write,track){
    let writePtr = write;
    let samplesWritten = 0;
    const trackBufferLen = buffers.mix.length / TRACK_COUNT;
    while(samplesWritten < samplesToFill){
        const remainingInPhysicalBuffer = trackBufferLen - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers.mix.subarray(track * trackBufferLen + writePtr, track * trackBufferLen + writePtr + chunkLength);
        chunkView.fill(0);      
        writePtr = (writePtr + chunkLength) % trackBufferLen;
        samplesWritten += chunkLength;
    }
    
    return writePtr;
}


function fillMixPlaybackBuffer(){
    if(proceed.mix!=="ready") return;
    proceed.mix = "working";
    const writePtr = Atomics.load(pointers.mix.write,0);
    const readPtr = Atomics.load(pointers.mix.read,0);
    const isFull = Atomics.load(pointers.mix.isFull,0);
    if(isFull){ 
        
        if(proceed.mix!=="off"){
            proceed.mix = "ready";
            setTimeout(()=>fillMixPlaybackBuffer(),25)
        }
        return;
    }
    const trackBufferLen = buffers.mix.length/TRACK_COUNT
    const available = writePtr === readPtr ? trackBufferLen : (readPtr - writePtr + trackBufferLen) % (trackBufferLen);
    let timelinePos;
    let writePtrPerTrack = writePtr;
    for(let track=0;track<timeline.mix.length;track++){
        let samplesToFill = available;
        writePtrPerTrack = writePtr;
        const length = timeline.mix[track].length;
        timelinePos = timeline.pos.mix
        while(samplesToFill>0){
            const region = length > 0 ? timeline.mix[track].find(reg => reg.end > timelinePos) : null;
            const sliceEnd = region ? Math.min(region.end, timeline.end) : timeline.end;
            let sliceLength = Math.min(samplesToFill, sliceEnd - timelinePos,trackBufferLen - writePtrPerTrack);
            if (sliceLength < 0) break; 
            if (region && timelinePos >= region.start && timelinePos < timeline.end) {
                // CASE: Fill from Take
                const handle = tracks[track].takeHandles[region.number];
                writePtrPerTrack = writeToMixRingBuffer(sliceLength, handle,region.start,writePtrPerTrack,track,timelinePos);
            } else {
                // CASE: Fill Silence (either leading silence or gap after timeline)
                sliceLength = region ? Math.min(sliceLength, region.start - timelinePos) : sliceLength;
                writePtrPerTrack = writeSilenceToMixRingBuffer(sliceLength,writePtrPerTrack,track);
            }
            // Advance timeline position
            timelinePos += sliceLength;
            samplesToFill -= sliceLength;
            
            // Handle Looping
            if (looping && timelinePos >= timeline.end){
                timelinePos = timeline.start;
            }
            //write ptr is adjusted in writeToRingBuffer / writeSilenceToRingBuffer
            }
    }
    timeline.pos.mix = timelinePos;
    const newWritePtr = (writePtr+available)%trackBufferLen
    Atomics.store(pointers.mix.write,0,newWritePtr);
    if(newWritePtr === readPtr){
        Atomics.store(pointers.mix.isFull,0,1);
    }
    if(proceed.mix!=="off"){proceed.mix = "ready";}
    setTimeout(()=>fillMixPlaybackBuffer(),50);
}

function fillStagingPlaybackBuffer(){
    if(proceed.staging!=="ready") return;
    proceed.staging = "working";
    const isFull = Atomics.load(pointers.staging.isFull,0);
    if(isFull){
        if(proceed.staging!=="off"){
            proceed.staging = "ready";
            setTimeout(()=>fillStagingPlaybackBuffer(),15)
        }
        return;
    };
    let writePtr = Atomics.load(pointers.staging.write, 0);
    let readPtr = Atomics.load(pointers.staging.read,0);
    let samplesLeftToFill = (readPtr - writePtr + buffers.staging.length) % buffers.staging.length;
    if(readPtr === writePtr){samplesLeftToFill = buffers.staging.length;}

    while(samplesLeftToFill > 0){
        const currTimeline = timeline.staging;
        const length = currTimeline.length;
        const take = length > 0 ? currTimeline.find(t => t.end > timeline.pos.staging) : null;
        const sliceEnd = take ? Math.min(take.end, timeline.end) : timeline.end;
        let sliceLength = Math.min(samplesLeftToFill, sliceEnd - timeline.pos.staging,buffers.staging.length - writePtr);
        if (sliceLength < 0) break; 
        if (take && timeline.pos.staging >= take.start && timeline.pos.staging < timeline.end) {
            // CASE: Fill from Take
            const handle = tracks[curr.track].takeHandles[take.number]
            writePtr = writeToStagingRingBuffer(sliceLength, handle,"staging",take.start,writePtr);
        } else {
            // CASE: Fill Silence (either leading silence or gap after timeline)
            sliceLength = take ? Math.min(sliceLength, take.start - timeline.pos.staging) : sliceLength;
            writePtr = writeSilenceToStagingRingBuffer(sliceLength,"staging",writePtr);
        }
        // Advance timeline position
        timeline.pos.staging += sliceLength;
        samplesLeftToFill -= sliceLength;
        
        // Handle Looping
        if (looping && timeline.pos.staging >= timeline.end){
            timeline.pos.staging = timeline.start;
        }
        //write ptr is adjusted in writeToRingBuffer / writeSilenceToRingBuffer
    }
    Atomics.store(pointers.staging.write,0,writePtr);
    if(writePtr === Atomics.load(pointers.staging.read,0)){
        Atomics.store(pointers.staging.isFull,0,1);
    }
    
    if(proceed.staging!=="off"){proceed.staging="ready";}
    setTimeout(()=>fillStagingPlaybackBuffer(),15);
    
}