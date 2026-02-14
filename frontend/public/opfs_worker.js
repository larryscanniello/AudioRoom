
import { getMixTimelineEndSample } from "./opfs_utils/getMixTimelineEndSample.ts";
import { writeToMipMap } from "./opfs_utils/writeToMipMap.ts";
import { fillPlaybackBufferUtil } from "./opfs_utils/fillPlaybackBufferUtil.ts";
import { writeToOPFSUtil } from "./opfs_utils/writeToOPFSUtil.ts";

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
    bounces: [],
    config: {
        TRACK_COUNT: null,
        MIX_MIPMAP_BUFFER_SIZE_PER_TRACK: null,
        MIX_BUFFER_SIZE: null
    }
}

const curr = {
    bounce: 0,
    take: 0,
}

const timeline = {
    staging: [],
    mix: [],
    start: 0,
    end: 15*60*48000,
    pos: {
        staging: 0,
        mix: 0,
    },
}

const mipMap = {
    staging: null,
    mix: null,
    halfSize: null,
    resolutions: null,
    buffer: null,
    totalTimelineSamples: null,
    isWorking: {
        staging: null,
        mix: null,
    }
}
let looping = false;

export const proceed = {
    record: null,
    staging: null,
    mix: null
}

async function listFiles(dir,dirstr="") {
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

async function removeHandles(root){
    for await (let [name,handle] of root) {
        if (handle.kind === 'file') {
        await handle.remove();
        } else {
        await removeHandles(handle);
        await handle.remove();
        }
    }
}

self.onmessage = (e) => {
    console.log("any sign of life?",e.data);
    if(e.data.type === "init"){
        console.log('opfs worker inited');
        const init = async () => {
            await removeHandles(await navigator.storage.getDirectory()); //delete all previous files in opfs
            const root = await navigator.storage.getDirectory();
            const uuid = crypto.randomUUID();
            const sessionDir = await root.getDirectoryHandle(`session_${uuid}`,{create:true});
            opfs.sessionDir = sessionDir;
            const currDir = await sessionDir.getDirectoryHandle(`bounce_${curr.bounce}`,{create:true});
            opfs.bounces.push({dirHandle:currDir,takeHandles:{}});
            const TRACK_COUNT = e.data.TRACK_COUNT;
            const MIX_MIPMAP_BUFFER_SIZE_PER_TRACK = e.data.MIX_MIPMAP_BUFFER_SIZE_PER_TRACK;
            const MIX_BUFFER_SIZE = e.data.MIX_BUFFER_SIZE;
            opfs.config.MIX_MIPMAP_BUFFER_SIZE_PER_TRACK = MIX_MIPMAP_BUFFER_SIZE_PER_TRACK;
            opfs.config.MIX_BUFFER_SIZE = MIX_BUFFER_SIZE;
            opfs.config.TRACK_COUNT = TRACK_COUNT;
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
                buffer: new Float32Array(opfs.config.TRACK_COUNT * opfs.config.MIX_MIPMAP_BUFFER_SIZE_PER_TRACK),
            })
            
            opfs.root = root;
        }
        init();
    }
    if(e.data.type === "init_recording"){
        const init_recording = async () => {
            if(!pointers.record.read || !pointers.record.write || !pointers.record.isFull ||
                !pointers.mix.read || !pointers.mix.write || !pointers.mix.isFull || !buffers.mix ||
                !opfs.config.TRACK_COUNT || !opfs.bounces || !buffers.record
            ){
                    console.error("Can't record. Recorder not initialized.");
                    return;
            };   
            const fileName = `bounce_${curr.bounce}_take_${curr.take}`
            const currTakeFile = await opfs.bounces[curr.bounce].dirHandle.getFileHandle(fileName,{create:true});
            const currTakeHandle = await currTakeFile.createSyncAccessHandle();
            opfs.bounces[curr.bounce].takeHandles[fileName] = currTakeHandle;
            const start = Math.round(e.data.timelineStart * 48000);
            const end = Math.round(e.data.timelineEnd * 48000);
            Object.assign(timeline,{
                staging: [e.data.timeline.staging],
                mix: e.data.timeline.mix,
                start,
                end,
                pos: {
                    mix: start,
                    staging: start,
                },
            });
            looping = e.data.looping;
            Atomics.store(pointers.record.read,0,0);
            Atomics.store(pointers.record.write,0,0);
            Atomics.store(pointers.record.isFull,0,0);
            Atomics.store(pointers.mix.read,0,0);
            Atomics.store(pointers.mix.write,0,0);
            Atomics.store(pointers.mix.isFull,0,0);
            proceed.record = "ready";
            writeToOPFS(
                pointers.record.read,
                pointers.record.write,
                pointers.record.isFull,
                buffers.record,
            );
            proceed.mix = "ready";
            fillMixPlaybackBuffer(
                pointers.mix.read,
                pointers.mix.write,
                pointers.mix.isFull,
                buffers.mix,
                opfs.config.TRACK_COUNT,
                opfs.bounces,
                timeline,
                looping,
            );
        }
        init_recording();
    }
    if(e.data.type === "init_playback"){
        if(!pointers.staging.read || !pointers.staging.write || !pointers.staging.isFull ||
            !pointers.mix.read || !pointers.mix.write || !pointers.mix.isFull || !buffers.staging || !buffers.mix ||
            !opfs.config.TRACK_COUNT || !opfs.bounces
        ){
                console.error("Can't play back. Player not initialized.");
                return;
        };
        console.log(e.data.timeline.staging,e.data.timeline.mix);
        const start = Math.round(e.data.timelineStart * 48000);
        const end = Math.round(e.data.timelineEnd * 48000);
        Object.assign(timeline,{
            staging: [e.data.timeline.staging],
            mix: e.data.timeline.mix,
            start,
            end,
            pos: {
                staging: start,
                mix: start,
            },
        });
        looping = e.data.looping;
        Atomics.store(pointers.staging.read,0,0);
        Atomics.store(pointers.staging.write,0,0);
        Atomics.store(pointers.staging.isFull,0,0);
        Atomics.store(pointers.mix.read,0,0);
        Atomics.store(pointers.mix.write,0,0);
        Atomics.store(pointers.mix.isFull,0,0);
        proceed.staging = "ready";
        fillStagingPlaybackBuffer(
            pointers.staging.read,
            pointers.staging.write,
            pointers.staging.isFull,
            buffers.staging,
            1,
            opfs.bounces,
            timeline,
            looping,
        );
        proceed.mix = "ready";
        fillMixPlaybackBuffer(
            pointers.mix.read,
            pointers.mix.write,
            pointers.mix.isFull,
            buffers.mix,
            opfs.config.TRACK_COUNT,
            opfs.bounces,
            timeline,
            looping,
        );
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
        if(!mipMap.isWorking.mix || !mipMap.totalTimelineSamples || !mipMap.resolutions || !mipMap.buffer || !mipMap.mix){
            console.error("Can't fill mipmap - not initialized");
            return;
        }
        const mixTimelines = e.data.mixTimelines;
        timeline.mix = mixTimelines;
        const endSample = getMixTimelineEndSample(mixTimelines);
        Atomics.store(mipMap.isWorking.mix,0,0);
        writeToMipMap(
            0,
            endSample,
            mixTimelines,
            mipMap.totalTimelineSamples,
            mipMap.resolutions,
            mipMap.buffer,
            mipMap.mix,
            opfs.bounces,
        );
        Atomics.store(mipMap.isWorking.mix,0,1,);
        postMessage({type:'mipmap_done'})
        curr.bounce ++;
        curr.take = 0;
        const createNewTrack = async () => {
            const newTrack = await opfs.sessionDir.getDirectoryHandle(`bouncek_${curr.bounce}`,{create:true});
            opfs.bounces.push({dirHandle:newTrack,takeHandles:{}});
        }
        createNewTrack();
    }
    if(e.data.type === "fill_staging_mipmap"){
        if(!mipMap.totalTimelineSamples || !mipMap.resolutions || !mipMap.buffer || !mipMap.staging){
            console.error("Can't fill staging mipmap - not initialized");
            return;
        }
        const newTake = e.data.newTake;
        timeline.staging = [e.data.timeline];
        writeToMipMap(
            newTake.start,
            newTake.end,
            timeline.staging,
            mipMap.totalTimelineSamples,
            mipMap.resolutions,
            mipMap.buffer,
            mipMap.staging,
            opfs.bounces,
        );
    }
    if(e.data.type === "cleanup"){
        opfs.bounces.forEach(bounce => {
            for (const [key, value] of Object.entries(bounce)) {
                value.close();
            }
        });
    }
}





export function fillMixPlaybackBuffer(
    read,
    write,
    isFullArr,
    buffer,
    TRACK_COUNT,
    bounces,
    timeline,
    looping,
){
    if(proceed.mix!=="ready") return;
    proceed.mix = "working";
    const writePtr = Atomics.load(write,0);
    const readPtr = Atomics.load(read,0);
    const isFull = Atomics.load(isFullArr,0);
    const timeOutms = (buffer.length/timeline.mix.length)*1000/48000/32;
    if(isFull){
        if(proceed.mix!=="off"){
            proceed.mix = "ready";
            setTimeout(()=>fillMixPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,timeline,looping),timeOutms)
        }
        return;
    }
    const {newWritePtr,timelinePos} = fillPlaybackBufferUtil(
        buffer,
        TRACK_COUNT,
        writePtr,
        readPtr,
        timeline.mix,
        bounces.slice(0,bounces.length-1),
        looping,
        timeline.pos.mix,
        {start:timeline.start,end:timeline.end},
    );
    timeline.pos.mix = timelinePos;
    Atomics.store(write,0,newWritePtr);
    if(newWritePtr === Atomics.load(read,0)){
        Atomics.store(isFullArr,0,1);
    };
    if(proceed.mix!=="off"){proceed.mix="ready";}
    setTimeout(()=>fillMixPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,timeline,looping),timeOutms);
};

export function fillStagingPlaybackBuffer(
    read,
    write,
    isFullArr,
    buffer,
    TRACK_COUNT,
    bounces,
    timeline,
    looping,
){
    if(proceed.staging!=="ready") return;
    proceed.staging = "working";
    const isFull = Atomics.load(isFullArr,0);
    const timeOutms = (buffer.length/timeline.staging.length)*1000/48000/32;

    if(isFull){
        if(proceed.staging!=="off"){
            proceed.staging = "ready";
            setTimeout(()=>fillStagingPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,timeline,looping),timeOutms)
        }
        return;
    };

    let writePtr = Atomics.load(write, 0);
    let readPtr = Atomics.load(read,0);
    const {newWritePtr,timelinePos} = fillPlaybackBufferUtil(
        buffer,
        TRACK_COUNT,
        writePtr,
        readPtr,
        timeline.staging,
        bounces.slice(bounces.length-1),
        looping,
        timeline.pos.staging,
        {start:timeline.start,end:timeline.end},
    );

    timeline.pos.staging = timelinePos;
    Atomics.store(write,0,newWritePtr);
    if(newWritePtr === Atomics.load(read,0)){
        Atomics.store(isFullArr,0,1);
    };
    if(proceed.staging!=="off"){proceed.staging="ready";}
    setTimeout(()=>fillStagingPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,timeline,looping),timeOutms);
    
}


function writeToOPFS(
    read,
    write,
    isFullArr,
    buffer,
){
    if(proceed.record!=="ready") return;
    proceed.record = "working";
    let readPtr = Atomics.load(read,0);
    const writePtr = Atomics.load(write,0);
    const isFull = Atomics.load(isFullArr,0);
    let samplesToWrite = (writePtr - readPtr + buffer.length) % buffer.length;
    if(isFull){samplesToWrite = buffer.length;}
    if(samplesToWrite===0){
        if(proceed.record!=="off"){
            proceed.record = "ready";
            setTimeout(()=>writeToOPFS(read,write,isFullArr,buffer),15);
        }
        return;
    }
    const handle = opfs.bounces[curr.bounce].takeHandles[`bounce_${curr.bounce}_take_${curr.take}`];
    readPtr = writeToOPFSUtil(samplesToWrite,buffer,readPtr,writePtr,handle);
    
    Atomics.store(read,0,readPtr);
    Atomics.store(isFullArr,0,0);
    if(proceed.record!=="off"){proceed.record = "ready";}
    setTimeout(()=>writeToOPFS(read,write,isFullArr,buffer),15);
}






