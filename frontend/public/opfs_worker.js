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
    staging: null,
    mix: null,
    start: null,
    end: null,
    pos: {
        staging: 0,
        mix: 0,
    },
}

let looping = false;

const proceed = {
    record: null,
    staging: null,
    mix: null
}

const tracks = [];

const PLAYBACK_BUFFER_SIZE = 48000 * 10;


async function listFiles(dir,dirstr) {
    let root;
    if(!dir){
        root = await navigator.storage.getDirectory();
    }else{root=dir;}
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
    console.log('cl han',dir);
    let root;
    if(!dir){
        root = await navigator.storage.getDirectory();
    }else{root=dir;}
    console.log('check root',root);
    for (let [name, handle] of root) {
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
            listFiles(await navigator.storage.getDirectory(),"root/");
            const root = await navigator.storage.getDirectory();
            const currDir = await root.getDirectoryHandle(`track_${curr.track}`,{create:true});
            tracks.push({dirHandle:currDir,takeHandles:[]});
            listFiles(root,"root/");
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
            const currTakeFile = await tracks[curr.track].dirHandle.getFileHandle(`track_${curr.track}_take_${curr.take}`,{create:true});
            const currTakeHandle = await currTakeFile.createSyncAccessHandle();
            tracks[curr.track].takeHandles.push(currTakeHandle);
            timeline.staging = e.data.timeline;
            timeline.start = Math.floor(e.data.timelineStart * 48000); //convert to samples
            curr.sample.mix = timeline.start;
            timeline.end = e.data.timelineEnd ? Math.floor(e.data.timelineEnd * 48000) : null;
            looping = e.data.looping;
            timeline.length = timeline.start - timeline.end;
            proceed.record = true;
            proceed.mix = true;
            writeToOPFS();
            fillMixPlaybackBuffer();
        }
        init_recording();
    }
    if(e.data.type === "init_playback"){
        const init_playback = async () => {
            Object.assign(timeline,{
                staging: e.data.stagingTimeline,
                start: e.data.timelineStart,
                end: 48000 * 10,
                pos: {
                    staging: e.data.timelineStart,
                    mix: e.data.timelineStart,
                }
            });
            proceed.staging = true;
            fillStagingPlaybackBuffer();
        }
        init_playback();
    }
    if(e.data.type === "stop_recording"){
        curr.take++;
        proceed.record = false;
        proceed.mix = false;
    }
    if(e.data.type === "stop_playback"){
        proceed.staging = false;
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
        const timeline = e.data.timeline;
        const bigArr = new Float32Array(timeline[timeline.length-1].end);
        for(const take of timeline){
            const slice = bigArr.subarray(take.start,take.end);
            tracks[curr.track].takeHandles[take.number].read(slice,{at:0});
        }
        let max = 0;
        for(let i=0;i<bigArr.length;i++){
            max = Math.max(0,bigArr[i]);
        }
        postMessage({bigArr},[bigArr.buffer]);
    }
    if(e.data.type === "cleanup"){
        tracks.forEach(track => {
            track.takeHandles.forEach(handle => handle.close());
        });
    }
}




function writeToRingBuffer(samplesToFill, handle, type, takeStart, writePtr) {
    let samplesWritten = 0;
    while (samplesWritten < samplesToFill) {
        const remainingInPhysicalBuffer = PLAYBACK_BUFFER_SIZE - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers[type].subarray(writePtr, writePtr + chunkLength);
        
        handle.read(chunkView, { at: timeline.pos[type] - takeStart });  
        writePtr = (writePtr + chunkLength) % PLAYBACK_BUFFER_SIZE;
        timeline.pos[type] += chunkLength;
        samplesWritten += chunkLength;
    }
}

function writeSilenceToRingBuffer(samplesToFill,type,writePtr){
    let samplesWritten = 0;
    while(samplesWritten < samplesToFill){
        const remainingInPhysicalBuffer = PLAYBACK_BUFFER_SIZE - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers[type].subarray(writePtr, writePtr + chunkLength);
        chunkView.fill(0);      
        writePtr = (writePtr + chunkLength) % PLAYBACK_BUFFER_SIZE;
        samplesWritten += chunkLength;
    }
}

function writeToOPFS(){
    let readPtr = Atomics.load(pointers.record.read,0);
    const writePtr = Atomics.load(pointers.record.write,0);
    const isFull = Atomics.load(pointers.record.isFull,0);
    let samplesToWrite = (writePtr - readPtr + buffers.record.length) % buffers.record.length;
    if(isFull){samplesToWrite = buffers.record.length;}
    if(samplesToWrite===0){
        if(proceed.record){setTimeout(()=>writeToOPFS(),15);}
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
    if(proceed.record){
        setTimeout(()=>writeToOPFS(),15);
    }
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
    if(proceed.mix){
        setTimeout(()=>fillMixPlaybackBuffer(),15);
    }
}

function fillStagingPlaybackBuffer(){
    const isFull = Atomics.load(pointers.staging.isFull,0);
    if(isFull){
        if(proceed.staging){setTimeout(()=>fillStagingPlaybackBuffer(),15)};
        return;
    };
    let writePtr = Atomics.load(pointers.staging.write, 0);
    let readPtr = Atomics.load(pointers.staging.read,0);
    let samplesLeftToFill = (readPtr - writePtr + buffers.staging.length) % buffers.staging.length;
    if(readPtr === writePtr){samplesLeftToFill = buffers.staging.length;}
    while(samplesLeftToFill > 0){
        const length = timeline.staging.length;
        const take = length > 0 ? timeline.staging.find(t => t.end > timeline.pos.staging) : null;
        const sliceEnd = take ? Math.min(take.end, timeline.end) : timeline.end;
        let sliceLength = Math.min(samplesLeftToFill, sliceEnd - timeline.pos.staging);
        if (sliceLength <= 0) break; 
        const handle = tracks[curr.track].takeHandles[/*take.number*/0];
        
        if (take && timeline.pos.staging >= take.start) {
            // CASE: Fill from Take
            writeToRingBuffer(sliceLength, handle,"staging",take.start,writePtr);
        } else {
            // CASE: Fill Silence (either leading silence or gap after timeline)
            sliceLength = take ? Math.min(sliceLength, take.start - timeline.pos.staging) : sliceLength;
            writeSilenceToRingBuffer(sliceLength,"staging",writePtr);
        }
        // Advance timeline position
        timeline.pos.staging += sliceLength;
        samplesLeftToFill -= sliceLength;
        
        // Handle Looping
        if (looping && timeline.pos.staging >= timeline.end){
            timeline.pos.staging = timeline.start;
        } else if (!looping && curr.sample.staging === timeline.end){
            break;
        }

        writePtr = (writePtr + sliceLength) % buffers.staging.length;
    }
    Atomics.store(pointers.staging.write,0,writePtr);
    Atomics.store(pointers.staging.isFull,0,1);
    if(proceed.staging){
        setTimeout(()=>fillStagingPlaybackBuffer(),15);
    }
}