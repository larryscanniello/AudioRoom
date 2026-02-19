import { CONSTANTS } from "../Constants/constants";
import { RingSAB } from "../Core/RingSAB";
import initOpusWasm from "./opus/opus";
import { EventTypes } from "../Core/Events/EventNamespace";

let wasmInstance = null;
let encodePCMPtr = 0;
let encodeOutPtr = 0;
let decodeInPtr = 0;
let decodePCMPtr = 0;
let lookahead = 0;
const FRAME_SIZE = 960;
const MAX_PACKET_SIZE = 4000;
let uint8View;
let dataView;
let encoderBuffer;
let proceed = "off";
let recordReader;
let recordSAB;
let opfsReader;
let opfsSAB;
let packetCount = 0;

self.onmessage = async (e) => {
    const { type, packet, packetCount, isRecording, recordingCount, OPlookahead, last } = e.data;

    if (type === 'initAudio') {
        wasmInstance = await initOpusWasm();

        wasmInstance._wasm_opus_init_encoder(CONSTANTS.SAMPLE_RATE,128000);
        wasmInstance._wasm_opus_init_decoder(CONSTANTS.SAMPLE_RATE);
        
        encodePCMPtr = wasmInstance._malloc(FRAME_SIZE * 4);
        decodePCMPtr = wasmInstance._malloc(FRAME_SIZE * 4);
        encodeOutPtr = wasmInstance._malloc(MAX_PACKET_SIZE);
        decodeInPtr = wasmInstance._malloc(MAX_PACKET_SIZE);
        encoderBuffer = new ArrayBuffer(4008);
        uint8View  = new Uint8Array(encoderBuffer);
        dataView = new DataView(encoderBuffer);

        lookahead = wasmInstance._wasm_opus_get_encoder_lookahead();

        const incomingAudioFloat32SAB = e.data.memory.buffers.record;
        const pointers = e.data.memory.pointers.record;
        recordReader = new Float32Array(CONSTANTS.PACKET_SIZE);
        recordSAB = new RingSAB(incomingAudioFloat32SAB,pointers,pointers.read);

        const incomingOPFSSAB = e.data.memory.buffers.opus;
        const opusPointers = e.data.memory.pointers.opus;
        opfsReader = new Uint8Array(CONSTANTS.PACKET_SIZE);
        opfsSAB = new RingSAB(incomingOPFSSAB, opusPointers);

    }

    if (type === EventTypes.START_RECORDING) {
        proceed = "ready";
        packetCount = 0;
        readTo(recordSAB, e.data);
    }

    if (type === EventTypes.STOP) {
        proceed = "off";
    }

    if (type === 'decode') {
        // payload is the compressed Uint8Array (the packet)        
        // 1. Copy compressed bytes into the outPtr loading dock
        wasmInstance.HEAPU8.set(packet, decodeInPtr);

        // 2. Decode into the pcmPtr loading dock
        const samplesDecoded = wasmInstance._wasm_opus_decode_float(
            decodeInPtr, 
            packet.length, 
            decodePCMPtr, 
            FRAME_SIZE,
        );


        if (samplesDecoded > 0) {
            // 3. Extract the raw PCM floats
            // Note: we slice from pcmPtr using HEAPF32
            let pcm = wasmInstance.HEAPF32.slice(decodePCMPtr >> 2, (decodePCMPtr >> 2) + samplesDecoded);
            if(packetCount===0){
                pcm = pcm.slice(lookahead);
            }

            opfsSAB.write(packet, 0, packet.length);

            self.postMessage({ type: 'decode', packet: pcm, packetCount, isRecording, recordingCount, lookahead:OPlookahead,last  }, [pcm.buffer]);
        }
    }
};

function readTo(recordSAB,data){
    if(proceed!=="ready") return;
    proceed = "working";
    const availableSamples = recordSAB.availableSamples();
    if(availableSamples===0){
        if(proceed!=="off"){
            proceed = "ready";
            setTimeout(()=>readTo(recordSAB,data),15);
        }
        return;
    }
    while(samplesToWrite>=CONSTANTS.PACKET_SIZE){
        recordSAB.read(reader,0,CONSTANTS.PACKET_SIZE);
        const encodedPacket = encode(reader,data);
        self.postMessage({type: "encode", packet: encodedPacket}, [encodedPacket]);
        packetCount++;
    }
    if(proceed!=="off"){proceed = "ready";}
    setTimeout(()=>readTo(recordSAB,data),15);
}

function encode(packet,data){

    const { isRecording, count } = data;
    const { bounce, take } = count;

    wasmInstance.HEAPF32.set(packet, encodePCMPtr >> 2);

    const encodedByteCount = wasmInstance._wasm_opus_encode_float(
        encodePCMPtr, 
        FRAME_SIZE, 
        encodeOutPtr, 
        MAX_PACKET_SIZE
    );

    if (encodedByteCount > 0) {

        /*
            The last flag is from a previous version of the project
            In this version of the project, OPFS handles packets dynamically
            and this flag isn't really necessary. I'm leaving it for now.
        */
        last = false;
        
        const encodedData = wasmInstance.HEAPU8.slice(encodeOutPtr, encodeOutPtr + encodedByteCount);
        uint8View[0] = 0;
        uint8View[0] += isRecording ? 1 : 0;
        uint8View[0] += last ? 2 : 0;

        dataView.setUint16(1, bounce, false);
        dataView.setUint16(3, take,false);
        dataView.setUint32(5, packetCount,false);
        dataView.setUint16(9, lookahead,false); 
        
        uint8View.set(encodedData, 11);

        const finalBuffer = encoderBuffer.slice(0, 11 + encodedByteCount);
        
        return finalBuffer;
        
    }
}