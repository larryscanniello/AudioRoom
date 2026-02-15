import type { Buffers, Pointers, Region } from "@/Types/AudioState.ts";
import type { MipMap } from "../Core/UI/UIEngine.ts";

import { getMixTimelineEndSample } from "./opfs_utils/getMixTimelineEndSample.ts";
import { writeToMipMap } from "./opfs_utils/writeToMipMap.ts";
import { fillPlaybackBufferUtil } from "./opfs_utils/fillPlaybackBufferUtil.ts";
import { writeToOPFSUtil } from "./opfs_utils/writeToOPFSUtil.ts";

import { EventTypes } from "../Core/Events/EventNamespace";

import {CONSTANTS} from "../Constants/constants"

/*
    Initializing all of these with empty arrays,
    but they will be populated with the correct values from 
    the main thread when the worker receives the init message.
*/
const buffers:Buffers = {
    staging: new Float32Array(),
    mix: new Float32Array(),
    record: new Float32Array(),
}

const pointers:Pointers = {
    staging: {
        read: new Uint32Array(),
        write: new Uint32Array(),
        isFull: new Uint32Array(),
    },
    mix: {
        read: new Uint32Array(),
        write: new Uint32Array(),
        isFull: new Uint32Array(),
    },
    record: {
        read: new Uint32Array(),
        write: new Uint32Array(),
        isFull: new Uint32Array(),
    }
}

export type OPFS = {
    root: FileSystemDirectoryHandle | null;
    sessionDir: FileSystemDirectoryHandle | null;
    bounces: {
        dirHandle: FileSystemDirectoryHandle;
        takeHandles: {[key: string]: any};
    }[]
    config: {
        TRACK_COUNT: number|null;
        MIX_MIPMAP_BUFFER_SIZE_PER_TRACK: number|null;
        MIX_BUFFER_SIZE: number|null;
    }
    timeline: {
        staging: Region[][];
        mix: Region[][];
        startSample: number;
        endSample: number;
        posSample: {
            staging: number;
            mix: number;
        }
    },
    mipMap: MipMap;
    mipMapBuffer: Float32Array;
    mipMapConfig: {
        halfSize: number;
        resolutions: number[];
        totalTimelineSamples: number;
    },
    
}

const opfs:OPFS = {
    root: null,
    sessionDir: null,
    bounces: [],
    config: {
        TRACK_COUNT: null,
        MIX_MIPMAP_BUFFER_SIZE_PER_TRACK: null,
        MIX_BUFFER_SIZE: null
    },
    timeline: {
        staging: [],
        mix: [],
        startSample: 0,
        endSample: 0,
        posSample: {
            staging: 0,
            mix: 0,
        }
     },
    mipMap: {
        staging: new Int8Array(),
        mix: new Int8Array(),
        empty: new Int8Array()
    },
    mipMapBuffer: new Float32Array(),
    mipMapConfig: {
        halfSize: 0,
        resolutions: [],
        totalTimelineSamples: 0,
    }
}



let looping = false;

type Proceed = {
    record: "ready"|"working"|"off"|null;
    staging: "ready"|"working"|"off"|null;
    mix: "ready"|"working"|"off"|null;
}

export const proceed: Proceed = {
    record: null,
    staging: null,
    mix: null
}
/*
async function listFiles(dir:any,dirstr:any) {
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
}*/

async function removeHandles(root:any){
    for await (let [_name,handle] of root) {
        if (handle.kind === 'file') {
        await handle.remove();
        } else {
        await removeHandles(handle);
        await handle.remove();
        }
    }
}

if(typeof self !== "undefined"){ //for testing, otherwise in testing self is undefined
self.onmessage = (e:any) => {
    console.log('opfs worker received message',e.data);
    if(e.data.type === "initAudio"){
        console.log('opfs worker audio inited');
        const init = async () => {
            await removeHandles(await navigator.storage.getDirectory()); //delete all previous files in opfs
            const root = await navigator.storage.getDirectory();
            const uuid = crypto.randomUUID();
            const sessionDir = await root.getDirectoryHandle(`session_${uuid}`,{create:true});
            opfs.sessionDir = sessionDir;
            const currDir = await sessionDir.getDirectoryHandle(`bounce_${0}`,{create:true});
            opfs.bounces.push({dirHandle:currDir,takeHandles:{}});
            const trackCount = CONSTANTS.MIX_MAX_TRACKS;
            opfs.config.MIX_MIPMAP_BUFFER_SIZE_PER_TRACK = CONSTANTS.MIPMAP_HALF_SIZE / trackCount;
            opfs.config.MIX_BUFFER_SIZE = e.data.memory.buffers.mix.length;
            opfs.config.TRACK_COUNT = trackCount;
            Object.assign(buffers,e.data.memory.buffers);
            Object.assign(pointers,e.data.memory.pointers);
            opfs.root = root;
        }
        init();
    }
    if(e.data.type === "initUI"){
        console.log('opfs worker UI inited',e.data);
        Object.assign(opfs.mipMap, e.data.mipMap);
        opfs.mipMapBuffer = new Float32Array(2**16);
        Object.assign(opfs.mipMapConfig, {
            halfSize: CONSTANTS.MIPMAP_HALF_SIZE,
            resolutions: CONSTANTS.MIPMAP_RESOLUTIONS,
            totalTimelineSamples: CONSTANTS.SAMPLE_RATE * CONSTANTS.TIMELINE_LENGTH_IN_SECONDS,
        });
    }
    if(e.data.type === EventTypes.START_RECORDING){
        const init_recording = async () => {
            if(!pointers.record.read || !pointers.record.write || !pointers.record.isFull ||
                !pointers.mix.read || !pointers.mix.write || !pointers.mix.isFull || !buffers.mix ||
                !opfs.config.TRACK_COUNT || !opfs.bounces || !buffers.record
            ){
                    console.error("Can't record. Recorder not initialized.");
                    return;
            };
            const bounce = e.data.state.count.bounce;
            const take = e.data.state.count.take;   
            const fileName = `bounce_${bounce}_take_${take}`
            const currTakeFile = await opfs.bounces[bounce].dirHandle.getFileHandle(fileName,{create:true});
            const currTakeHandle = await (currTakeFile as any).createSyncAccessHandle();
            opfs.bounces[bounce].takeHandles[fileName] = currTakeHandle;
            const start = Math.round(e.data.timelineStart * CONSTANTS.SAMPLE_RATE);
            const end = Math.round(e.data.timelineEnd * CONSTANTS.SAMPLE_RATE);
            
            opfs.timeline.staging = [e.data.timeline.staging];
            opfs.timeline.mix = e.data.timeline.mix;
            opfs.timeline.startSample = start;
            opfs.timeline.endSample = end;
            opfs.timeline.posSample.mix = start;
            opfs.timeline.posSample.staging = start;

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
                looping,
            );
        }
        init_recording();
    }
    if(e.data.type === EventTypes.START_PLAYBACK){
        if(!pointers.staging.read || !pointers.staging.write || !pointers.staging.isFull ||
            !pointers.mix.read || !pointers.mix.write || !pointers.mix.isFull || !buffers.staging || !buffers.mix ||
            !opfs.config.TRACK_COUNT || !opfs.bounces
        ){
                console.error("Can't play back. Player not initialized.");
                return;
        };
        const start = Math.round(e.data.timelineStart * CONSTANTS.SAMPLE_RATE);
        const end = Math.round(e.data.timelineEnd * CONSTANTS.SAMPLE_RATE);

        opfs.timeline.staging = [e.data.timeline.staging];
        opfs.timeline.mix = e.data.timeline.mix;
        opfs.timeline.startSample = start;
        opfs.timeline.endSample = end;
        opfs.timeline.posSample.mix = start;
        opfs.timeline.posSample.staging = start;

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
            looping,
        );
    }
    if(e.data.type === EventTypes.STOP){
        proceed.record = "off";
        proceed.staging = "off";
        proceed.mix = "off";
    }
    if(e.data.type === "bounce_to_mix"){
        if( !opfs.mipMapConfig.totalTimelineSamples || !opfs.mipMapConfig.resolutions || !opfs.mipMapBuffer.length || !opfs.mipMap.mix){
            console.error("Can't fill mipmap - not initialized");
            return;
        }
        const mixTimelines = e.data.mixTimelines;
        opfs.timeline.mix = mixTimelines;
        const endSample = getMixTimelineEndSample(mixTimelines);
        Atomics.store(opfs.mipMap.mix,0,0);
        writeToMipMap(
            0,
            endSample,
            mixTimelines,
            opfs.mipMapConfig.totalTimelineSamples,
            opfs.mipMapConfig.resolutions,
            opfs.mipMapBuffer,
            opfs.mipMap.mix,
            opfs.bounces,
        );
        Atomics.store(opfs.mipMap.mix,0,0);
        postMessage({type:'mipmap_done'})
        const createNewTrack = async () => {
            const newTrack = await opfs.sessionDir!.getDirectoryHandle(`bounce_${curr.bounce}`,{create:true});
            opfs.bounces.push({dirHandle:newTrack,takeHandles:{}});
        }
        createNewTrack();
    }
    if(e.data.type === "fill_staging_mipmap"){
        if(!opfs.mipMapConfig.totalTimelineSamples || !opfs.mipMapConfig.resolutions || !opfs.mipMapBuffer || !opfs.mipMap.staging){
            console.error("Can't fill staging mipmap - not initialized",
                "mipMapConfig:", opfs.mipMapConfig,
                "mipMapBuffer:", opfs.mipMapBuffer,
                "mipMap:", opfs.mipMap
            );
            return;
        }
        const newTake = e.data.newTake;
        opfs.timeline.staging = e.data.timeline.staging;
        writeToMipMap(
            newTake.start,
            newTake.end,
            opfs.timeline.staging,
            opfs.mipMapConfig.totalTimelineSamples,
            opfs.mipMapConfig.resolutions,
            opfs.mipMapBuffer,
            opfs.mipMap.staging,
            opfs.bounces,
        );
        Atomics.store(opfs.mipMap.staging,0,0);
        postMessage({type:'staging_mipmap_done'})
    }
    if(e.data.type === "cleanup"){
        opfs.bounces.forEach(bounce => {
            for (const [_key, value] of Object.entries((bounce as any).takeHandles)) {
                (value as any).close();
            }
        });
    }
}
}




export function fillMixPlaybackBuffer(
    read:Uint32Array,
    write:Uint32Array,
    isFullArr:Uint32Array,
    buffer:Float32Array,
    TRACK_COUNT:number,
    bounces:{dirHandle:FileSystemDirectoryHandle,takeHandles:{[key:string]:any}}[],
    looping:boolean,
){
    if(proceed.mix!=="ready") return;
    proceed.mix = "working";
    const writePtr = Atomics.load(write,0);
    const readPtr = Atomics.load(read,0);
    const isFull = Atomics.load(isFullArr,0);
    const timeOutms = (buffer.length/opfs.timeline.mix.length)*1000/48000/32;
    if(isFull){
        if((proceed as Proceed).mix!=="off"){
            proceed.mix = "ready";
            setTimeout(()=>fillMixPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,looping),timeOutms)
        }
        return;
    }
    const {newWritePtr,timelinePos} = fillPlaybackBufferUtil(
        buffer,
        TRACK_COUNT,
        writePtr,
        readPtr,
        opfs.timeline.mix,
        bounces.slice(0,bounces.length-1),
        looping,
        opfs.timeline.posSample.mix,
        {start:opfs.timeline.startSample, end:opfs.timeline.endSample},
    );
    opfs.timeline.posSample.mix = timelinePos;
    Atomics.store(write,0,newWritePtr);
    if(newWritePtr === Atomics.load(read,0)){
        Atomics.store(isFullArr,0,1);
    };
    if((proceed as Proceed).mix!=="off"){proceed.mix="ready";}
    setTimeout(()=>fillMixPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,looping),timeOutms);
};

export function fillStagingPlaybackBuffer(
    read:Uint32Array,
    write:Uint32Array,
    isFullArr:Uint32Array,
    buffer:Float32Array,
    TRACK_COUNT:number,
    bounces:{dirHandle:FileSystemDirectoryHandle,takeHandles:{[key:string]:any}}[],
    looping:boolean,
){
    if(proceed.staging!=="ready") return;
    proceed.staging = "working";
    const isFull = Atomics.load(isFullArr,0);
    const timeOutms = (buffer.length/opfs.timeline.staging.length)*1000/48000/32;

    if(isFull){
        if((proceed as Proceed).staging!=="off"){
            proceed.staging = "ready";
            setTimeout(()=>fillStagingPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,looping),timeOutms)
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
        opfs.timeline.staging,
        bounces.slice(bounces.length-1),
        looping,
        opfs.timeline.posSample.staging,
        {start:opfs.timeline.startSample, end:opfs.timeline.endSample},
    );

    opfs.timeline.posSample.staging = timelinePos;
    Atomics.store(write,0,newWritePtr);
    if(newWritePtr === Atomics.load(read,0)){
        Atomics.store(isFullArr,0,1);
    };
    if((proceed as Proceed).staging!=="off"){proceed.staging="ready";}
    setTimeout(()=>fillStagingPlaybackBuffer(read,write,isFullArr,buffer,TRACK_COUNT,bounces,looping),timeOutms);
    
}


function writeToOPFS(
    read:Uint32Array,
    write:Uint32Array,
    isFullArr:Uint32Array,
    buffer:Float32Array,
){
    if(proceed.record!=="ready") return;
    proceed.record = "working";
    let readPtr = Atomics.load(read,0);
    const writePtr = Atomics.load(write,0);
    const isFull = Atomics.load(isFullArr,0);
    let samplesToWrite = (writePtr - readPtr + buffer.length) % buffer.length;
    if(isFull){samplesToWrite = buffer.length;}
    if(samplesToWrite===0){
        if((proceed as Proceed).record!=="off"){
            proceed.record = "ready";
            setTimeout(()=>writeToOPFS(read,write,isFullArr,buffer),15);
        }
        return;
    }
    const handle = opfs.bounces[curr.bounce].takeHandles[`bounce_${curr.bounce}_take_${curr.take}`];
    readPtr = writeToOPFSUtil(samplesToWrite,buffer,readPtr,writePtr,handle);
    
    Atomics.store(read,0,readPtr);
    Atomics.store(isFullArr,0,0);
    if((proceed as Proceed).record!=="off"){proceed.record = "ready";}
    setTimeout(()=>writeToOPFS(read,write,isFullArr,buffer),15);
}

export { opfs };






