import type { Buffers, Pointers, Region } from "@/Types/AudioState.ts";
import type { MipMap } from "./opfs_utils/types.ts";

import { getMixTimelineEndSample } from "./opfs_utils/getMixTimelineEndSample.ts";
import { fillPlaybackBufferUtil } from "./opfs_utils/fillPlaybackBufferUtil.ts";
import { writeToOPFSUtil } from "./opfs_utils/writeToOPFSUtil.ts";

import type { AudioProcessorData } from "../Types/AudioState.ts";

import { EventTypes } from "../Core/Events/EventNamespace";

import {CONSTANTS} from "../Constants/constants"

import { MipMapManager } from "./opfs_utils/MipMapManager";

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
        readOPFS: new Uint32Array(),
        readStream: new Uint32Array(),
        write: new Uint32Array(),
        isFull: new Uint32Array(),
    },
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
        staging: readonly Region[][];
        mix: readonly Region[][];
        startSample: number;
        endSample: number;
        posSample: {
            staging: number;
            mix: number;
        }
    },
    mipMapManager: MipMapManager | null;
    curr:{
        bounce: number;
        take: number;
    }
    incomingStream:{
        isInitializing: boolean;
        queue: DecodeAudioData[];
    }
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
    mipMapManager: null,
    curr:{
        bounce: 0,
        take: 0,
    },
    incomingStream:{
        isInitializing: false,
        queue: [],
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

/*async function listFiles(dir:any,dirstr:any) {
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

export type OPFSEventData = OPFSInitAudioData | OPFSInitUIData | 
AudioProcessorData | OPFSStopData | OPFSFillStagingMipMapData |
OPFSBounceToMixData | DecodeAudioData | {type: "cleanup"};

type OPFSInitAudioData = {
    type: "initAudio";
    memory: {
        buffers: Buffers;
        pointers: Pointers;
    }
}

type OPFSInitUIData = {
    type: "initUI";
    mipMap: MipMap;
}

type OPFSStopData = {
    type: typeof EventTypes.STOP;
}

type OPFSFillStagingMipMapData = {
    type: "fill_staging_mipmap";
    timeline: {
        staging: readonly Region[][];
        mix: readonly Region[][];
    },
    start: number;
    end: number;
}

type OPFSBounceToMixData = {
    type: "bounce_to_mix";
    bounce: number;
    mixTimelines: readonly Region[][];
}

type DecodeAudioData = { 
    type: "decode";
    packet: ArrayBuffer;
    packetCount: number;
    bounce: number;
    take: number;
    lookahead: number;
}

type OPFSMessageEvent = MessageEvent<OPFSEventData>;

if (typeof self !== "undefined") { // for testing, otherwise in testing self is undefined
    self.onmessage = (e: OPFSMessageEvent) => {
        switch (e.data.type) {
            case "initAudio":
                console.log('opfs worker audio inited');
                const init = async () => {
                    if (e.data.type !== "initAudio") {
                        console.error("Expected initAudio data");
                        return;
                    }

                    // initialize opfs stuff: root directory, session directory, first bounce directory
                    await removeHandles(await navigator.storage.getDirectory()); // delete all previous files in opfs
                    const root = await navigator.storage.getDirectory();
                    const uuid = crypto.randomUUID();
                    const sessionDir = await root.getDirectoryHandle(`session_${uuid}`, { create: true });
                    opfs.sessionDir = sessionDir;
                    const currDir = await sessionDir.getDirectoryHandle(`bounce_${0}`, { create: true });

                    // initialize buffers and pointers for recording
                    opfs.bounces.push({ dirHandle: currDir, takeHandles: {} });
                    const trackCount = CONSTANTS.MIX_MAX_TRACKS;
                    opfs.config.MIX_MIPMAP_BUFFER_SIZE_PER_TRACK = CONSTANTS.MIPMAP_HALF_SIZE / trackCount;
                    opfs.config.MIX_BUFFER_SIZE = e.data.memory.buffers.mix.length;
                    opfs.config.TRACK_COUNT = trackCount;
                    Object.assign(buffers, e.data.memory.buffers);
                    Object.assign(pointers, e.data.memory.pointers);
                    opfs.root = root;
                };

                init();
                break;

            case "initUI":
                console.log('opfs worker UI inited');
                opfs.mipMapManager = new MipMapManager(e.data.mipMap);
                break;

            case EventTypes.START_RECORDING:
                const init_recording = async () => {
                    if(!pointers.record.readOPFS || !pointers.record.readStream || !pointers.record.write || !pointers.record.isFull ||
                        !pointers.mix.read || !pointers.mix.write || !pointers.mix.isFull || !buffers.mix ||
                        !opfs.config.TRACK_COUNT || !opfs.bounces || !buffers.record
                    ){
                        console.error("Can't record. Recorder not initialized.");
                        return;
                    };
                    if(e.data.type !== EventTypes.START_RECORDING){
                        console.error("Expected START_RECORDING data");
                        return;
                    }


                    const bounce = e.data.state.count.bounce;
                    const take = e.data.state.count.take;   
                    const fileName = `bounce_${bounce}_take_${take}`
                    const currTakeFile = await opfs.bounces[bounce].dirHandle.getFileHandle(fileName,{create:true});
                    const currTakeHandle = await (currTakeFile as any).createSyncAccessHandle();
                    opfs.bounces[bounce].takeHandles[fileName] = currTakeHandle;
                    const start = Math.round(e.data.timeline.start * CONSTANTS.SAMPLE_RATE);
                    const end = Math.round(e.data.timeline.end * CONSTANTS.SAMPLE_RATE);
                    
                    opfs.curr.take = take;
                    opfs.curr.bounce = bounce;

                    opfs.timeline.staging = e.data.timeline.staging;
                    opfs.timeline.mix = e.data.timeline.mix;
                    opfs.timeline.startSample = start;
                    opfs.timeline.endSample = end;
                    opfs.timeline.posSample.mix = start;
                    opfs.timeline.posSample.staging = start;

                    

                    looping = e.data.state.looping;
                    proceed.record = "ready";
                    writeToOPFS(
                        pointers.record.readOPFS,
                        pointers.record.write,
                        pointers.record.isFull,
                        buffers.record,
                        opfs.mipMapManager!,
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
                break;

            case EventTypes.START_PLAYBACK:
                if(!pointers.staging.read || !pointers.staging.write || !pointers.staging.isFull ||
                    !pointers.mix.read || !pointers.mix.write || !pointers.mix.isFull || !buffers.staging || !buffers.mix ||
                    !opfs.config.TRACK_COUNT || !opfs.bounces
                ){
                    console.error("Can't play back. Player not initialized.");
                    return;
                };
                const start = Math.round(e.data.timeline.start * CONSTANTS.SAMPLE_RATE);
                const end = Math.round(e.data.timeline.end * CONSTANTS.SAMPLE_RATE);

                opfs.timeline.staging = e.data.timeline.staging;
                opfs.timeline.mix = e.data.timeline.mix;
                opfs.timeline.startSample = start;
                opfs.timeline.endSample = end;
                opfs.timeline.posSample.mix = start;
                opfs.timeline.posSample.staging = start;

                looping = e.data.state.looping;
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
                break;

            case EventTypes.OTHER_PERSON_RECORDING:
                opfs.timeline.startSample = Math.round(e.data.timeline.start * CONSTANTS.SAMPLE_RATE);
                break;
                
            case EventTypes.STOP:
                proceed.record = "off";
                proceed.staging = "off";
                proceed.mix = "off";
                
                break;

            case "bounce_to_mix":
                if (!opfs.mipMapManager) {
                    console.error("Can't fill mipmap - not initialized");
                    return;
                }
                const bounce = e.data.bounce;
                const mixTimelines = e.data.mixTimelines;
                opfs.timeline.mix = mixTimelines;
                const endSample = getMixTimelineEndSample(mixTimelines);
                opfs.mipMapManager.synchronize();
                opfs.mipMapManager.write(
                    { startSample: 0, endSample },
                    mixTimelines,
                    opfs.bounces,
                    "mix",
                );
                opfs.mipMapManager.synchronize();
                const createNewTrack = async () => {
                    const newTrack = await opfs.sessionDir!.getDirectoryHandle(`bounce_${bounce}`,{create:true});
                    opfs.bounces.push({dirHandle:newTrack,takeHandles:{}});
                    postMessage({type:'bounce_to_mix_done'})
                }
                createNewTrack();
                break;

            case "fill_staging_mipmap":
                if (!opfs.mipMapManager) {
                    console.error("Can't fill staging mipmap - not initialized");
                    return;
                }
                opfs.timeline.staging = e.data.timeline.staging;
                opfs.mipMapManager.write(
                    { startSample: e.data.start, endSample: e.data.end },
                    opfs.timeline.staging,
                    opfs.bounces,
                    "staging",
                );
                postMessage({type:'staging_mipmap_done'})
                break;
            case "decode":
                writeStreamedPacketToOPFS(e.data,opfs);
                break;

            case "cleanup":
                opfs.bounces.forEach(bounce => {
                    for (const [_key, value] of Object.entries((bounce as any).takeHandles)) {
                        (value as any).close();
                    }
                });
                break;
;
        }
    };
}

export async function writeStreamedPacketToOPFS(
    data: DecodeAudioData,
    opfs: OPFS,
){
    const {packet, packetCount, bounce, take, lookahead } = data;
    
    if(bounce !== opfs.curr.bounce){
        console.error("Bounces are unsynchronized. Something is wrong.")
        opfs.curr.bounce = bounce;
    }

    const fileName = `bounce_${bounce}_take_${take}`;


    if (!opfs.bounces[bounce].takeHandles[fileName]) {
        if (opfs.incomingStream.isInitializing){
            opfs.incomingStream.queue.push(data);
            return;
        };
        opfs.incomingStream.queue = [];
        opfs.incomingStream.isInitializing = true;
        const currTakeFile = await opfs.bounces[bounce].dirHandle.getFileHandle(fileName, {create: true});
        const handle = await (currTakeFile as any).createSyncAccessHandle();
        opfs.bounces[bounce].takeHandles[fileName] = handle;
        opfs.curr.take = take;
        opfs.incomingStream.isInitializing = false;const slicedPacket = packet.slice(lookahead * Float32Array.BYTES_PER_ELEMENT);
        handle.write(slicedPacket, {at: 0});
        opfs.mipMapManager?.write(
            { startSample: opfs.timeline.startSample, endSample: opfs.timeline.startSample + (slicedPacket.byteLength / Float32Array.BYTES_PER_ELEMENT) },
            [], [], "staging",
            new Float32Array(slicedPacket)
        )
        postMessage({type:"staging_mipmap_done"})
        return;
    }

    const lookaheadInBytes = lookahead * Float32Array.BYTES_PER_ELEMENT;
    const handle = opfs.bounces[bounce].takeHandles[fileName];
    
    const writeToOPFS = (packet: ArrayBuffer, packetCount: number) => {
        const fileLengthInBytes = handle.getSize();
        const byteIndexToInsertPacket =
            packetCount * CONSTANTS.PACKET_SIZE * Float32Array.BYTES_PER_ELEMENT - lookaheadInBytes;

        if (fileLengthInBytes < byteIndexToInsertPacket) {
            const numOfZeroBytesToFill = Math.max(byteIndexToInsertPacket - fileLengthInBytes, 0);
            const zeroBuffer = new Float32Array(numOfZeroBytesToFill / Float32Array.BYTES_PER_ELEMENT);
            handle.write(zeroBuffer, { at: fileLengthInBytes });
        }

        handle.write(packet, { at: byteIndexToInsertPacket });

        const mipPacket = packetCount === 0 ? packet.slice(lookaheadInBytes) : packet;

        const packetStartSample =
            opfs.timeline.startSample + byteIndexToInsertPacket / Float32Array.BYTES_PER_ELEMENT;
        const packetEndSample =
            packetStartSample + mipPacket.byteLength / Float32Array.BYTES_PER_ELEMENT;

        opfs.mipMapManager?.write(
            { startSample: packetStartSample, endSample: packetEndSample },
            [],
            [],
            "staging",
            new Float32Array(mipPacket)
        );

        postMessage({ type: "staging_mipmap_done" });
    }

    if(opfs.incomingStream.queue.length > 0){
        opfs.incomingStream.queue.forEach(
            (queuedData:DecodeAudioData) => {writeToOPFS(queuedData.packet, queuedData.packetCount)}
        )
        opfs.incomingStream.queue = [];
    }

    writeToOPFS(packet, packetCount);

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
        opfs.bounces.slice(0, opfs.bounces.length-1),
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
        opfs.bounces.slice(opfs.bounces.length-1),
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
    mipMapManager: MipMapManager,
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
            setTimeout(()=>writeToOPFS(read,write,isFullArr,buffer,mipMapManager),15);
        }
        return;
    }
    const handle = opfs.bounces[opfs.curr.bounce].takeHandles[`bounce_${opfs.curr.bounce}_take_${opfs.curr.take}`];
    let oldReadPtr = readPtr;
    readPtr = writeToOPFSUtil(
        samplesToWrite,
        buffer,
        readPtr,
        handle,
        opfs.mipMapManager,
        opfs.timeline.startSample,
    );
    if(readPtr !== oldReadPtr){
        postMessage({type:"staging_mipmap_done"})
    }
    Atomics.store(read,0,readPtr);
    Atomics.store(isFullArr,0,0);
    if((proceed as Proceed).record!=="off"){proceed.record = "ready";}
    setTimeout(()=>writeToOPFS(read,write,isFullArr,buffer,mipMapManager),15);
}

export { opfs };






