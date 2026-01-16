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

const mipMap = {
    staging: null,
    mix: null,
    halfLength: null,
    resolutions: null,
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
            mipMap = new Uint8Array(e.data.mipMapSAB);
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
                staging: new Int8Array(e.data.mipMap.staging.subarray(1)),
                mix: new Int8Array(e.data.mipMap.mix.subarray(1)),
                isWorking: {
                    staging: new Int8Array(e.data.mipMap.staging.subarray(0,1)),
                    mix: new Int8Array(e.data.mipMap.mix.subarray(0,1)),
                },
                halfSize: e.data.MIPMAP_HALF_SIZE,
                resolutions: e.data.MIPMAX_RESOLUTIONS,
                totalTimelineSamples:e.data.TOTAL_TIMELINE_SAMPLES,
                buffer: new Float32Array(65536),
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
                start: Math.round(e.data.timelineStart*48000),
                end: e.data.timelineEnd,
                pos: {
                    staging: Math.round(48000*e.data.timelineStart),
                    mix: Math.round(48000*e.data.timelineStart),
                }
            });
            Atomics.store(pointers.staging.read,0,0);
            Atomics.store(pointers.staging.write,0,0);
            Atomics.store(pointers.staging.isFull,0,0);
            proceed.staging = "ready";
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
        proceed.staging = "off";
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
    if(e.data.type === "fill_staging_mipmap"){
        const newTake = e.data.newTake;
        writeToMipMap(type,newTake);
        for(const reg of currTimeline){
            const slice = bigArr.subarray(reg.start,reg.end);
            tracks[curr.track].takeHandles[reg.number].read(slice,{at:0});
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

function writeToMipMap(type,newTake){
    Atomics.store(mipMap.isWorking[type],0,1);
    const int8 = mipMap[type];
    const halfLength = mipMap.halfLength;
    const resolutions = mipMap.resolutions;
    const iterateAmount = mipMap.totalTimelineSamples / resolutions[0];
    let iterateAmountMultiple = 0;
    let i=newTake.start;
    let startBucket = 0;
    while(iterateAmountMultiple + iterateAmount < newTake.start){
        iterateAmountMultiple += iterateAmount;
        startBucket += 1;
    }
    let currBucket = startBucket;
    let max,min;
    let bufferIndex = 0;
    let at = 0;
    //fill the bottom layer of the pyramid of the mipmap
    while(i<newTake.end){
        if(bufferIndex >= mipMap.buffer.length){
            tracks[curr.track].takeHandles[newTake.number].read(mipMap.buffer.length,{at})
            at = bufferIndex;
            bufferIndex = 0;
        }
        if(i >= iterateAmountMultiple || i===newTake.end-1){
            iterateAmountMultiple += iterateAmount;
            int8[currBucket] = Math.floor(127 * max);
            int8[mipMap.halfLength + currBucket] = Math.floor(127 * min);
            currBucket += 1;
            min = 1; max = -1;
        }
        max = Math.max(max,buffer[bufferIndex]);
        min = Math.min(min,buffer[bufferIndex])
        i += 1; bufferIndex += 1;
    } 
    //fill rest of the pyramid
    count = 1;
    while(count < mipMap.resolutions.length){
        let start = resolutions.slice(0,count).reduce((acc, curr) => acc + curr, 0) + Math.floor(startBucket/2**count);
        let end = resolutions.slice(0,count).reduce((acc, curr) => acc + curr, 0) + Math.floor(startBucket/2**count);
        for(let j=start;j<end;j++){
            const k = Math.floor(j/2);
            const maxOption1 = int8[k];
            const maxOption2 = int8[k+1];
            int8[j] = Math.max(maxOption1,maxOption2);
            const minOption1 = int8[halfLength + k];
            const minOption2 = int8[halfLength + k + 1];
            int8[j + halfLength] = Math.min(minOption1,minOption2);
        }
        count += 1;
    }
    Atomics.store(mipMap.isWorking[type],0,1);
    postMessage({type:'mipmap_done'})
}




function writeToRingBuffer(samplesToFill, handle, type, takeStart, writePtr) {
    let samplesWritten = 0;
    while (samplesWritten < samplesToFill) {
        const remainingInPhysicalBuffer = PLAYBACK_BUFFER_SIZE - writePtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = buffers[type].subarray(writePtr, writePtr + chunkLength);
        
        handle.read(chunkView, { at: timeline.pos[type] - takeStart });  
        writePtr = (writePtr + chunkLength) % PLAYBACK_BUFFER_SIZE;
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
    if(!proceed.record) return;
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
    setTimeout(()=>writeToOPFS(),15);
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
    if(proceed.staging!=="ready") return;
    proceed.staging = "working";
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
        console.log('timeline',timeline);
        const currTimeline = timeline.staging.length > 0 ? timeline.staging[timeline.staging.length-1] : [];
        const length = currTimeline.length;
        console.log('currTimeline',currTimeline,'len',currTimeline.length);
        const take = length > 0 ? currTimeline.find(t => t.end > timeline.pos.staging) : null;
        console.log('take',take,'timelineend',timeline.end,'takeend',take?take.end:null);
        const sliceEnd = take ? Math.min(take.end, timeline.end) : timeline.end;
        console.log('timelineposstaging',timeline.pos.staging);
        let sliceLength = Math.min(samplesLeftToFill, sliceEnd - timeline.pos.staging);
        if (sliceLength <= 0) break; 
        if (take && timeline.pos.staging >= take.start && timeline.pos.staging < timeline.end) {
            // CASE: Fill from Take
            const handle = tracks[curr.track].takeHandles[take.number];
            writeToRingBuffer(sliceLength, handle,"staging",take.start,writePtr);
            console.log('wtrb',sliceLength,timeline.pos.staging);
        } else {
            // CASE: Fill Silence (either leading silence or gap after timeline)
            sliceLength = take ? Math.min(sliceLength, take.start - timeline.pos.staging) : sliceLength;
            writeSilenceToRingBuffer(sliceLength,"staging",writePtr);
            console.log('wstrb',sliceLength,timeline.pos.staging);
        }
        // Advance timeline position
        timeline.pos.staging += sliceLength;
        samplesLeftToFill -= sliceLength;
        
        // Handle Looping
        if (looping && timeline.pos.staging >= timeline.end){
            timeline.pos.staging = timeline.start;
        }

        writePtr = (writePtr + sliceLength) % buffers.staging.length;
    }
    Atomics.store(pointers.staging.write,0,writePtr);
    Atomics.store(pointers.staging.isFull,0,1);
    if(proceed.staging!=="off"){proceed.staging="ready";}
    setTimeout(()=>fillStagingPlaybackBuffer(),15);
    
}