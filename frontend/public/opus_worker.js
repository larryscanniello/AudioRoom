import initOpusWasm from "./opus/opus.js";

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
let incomingUInt8Wrapper;
let recordBufferToSend;


self.onmessage = async (e) => {
    const { type, packet, packetCount, isRecording, recordingCount, OPlookahead, last } = e.data;

    if (type === 'init') {
        wasmInstance = await initOpusWasm(); // Assuming this returns the Emscripten/WASM object

        wasmInstance._wasm_opus_init_encoder(48000,128000);
        wasmInstance._wasm_opus_init_decoder(48000);
        
        // PRE-ALLOCATE: Do this once, not in the loop!
        encodePCMPtr = wasmInstance._malloc(FRAME_SIZE * 4); // 4 bytes per float
        decodePCMPtr = wasmInstance._malloc(FRAME_SIZE * 4);
        encodeOutPtr = wasmInstance._malloc(MAX_PACKET_SIZE);
        decodeInPtr = wasmInstance._malloc(MAX_PACKET_SIZE);
        recordBufferToSend = new ArrayBuffer(4008);
        uint8View  = new Uint8Array(recordBufferToSend);
        dataView = new DataView(recordBufferToSend);
        //incomingUint8WrapperRef.current = new Uint8Array()

        lookahead = wasmInstance._wasm_opus_get_encoder_lookahead();

        console.log("lookahead",lookahead);
    }

    if (type === 'encode') {
        // payload is the Float32Array transferred from the Worklet
        
        // 1. Copy the data into the PRE-ALLOCATED WASM heap
        // This is a memory copy, but it's much faster than an allocation
        
        wasmInstance.HEAPF32.set(packet, encodePCMPtr >> 2);

        // 2. Call your C function with the pointers
        const encodedByteCount = wasmInstance._wasm_opus_encode_float(
            encodePCMPtr, 
            FRAME_SIZE, 
            encodeOutPtr, 
            MAX_PACKET_SIZE
        );

        if (encodedByteCount > 0) {
            // 3. Extract the bytes from the WASM heap
            // We use .slice() here because we are about to transfer this out
            const encodedData = wasmInstance.HEAPU8.slice(encodeOutPtr, encodeOutPtr + encodedByteCount);


              // 2. Set Flags (1 byte)
            uint8View[0] = 0;
            uint8View[0] += isRecording ? 1 : 0;
            uint8View[0] += last ? 2 : 0;

            // 3. Set 32-bit Packet Count (4 bytes) - No 'new' needed
            // This writes to indices 1, 2, 3, and 4
            dataView.setUint32(1, recordingCount, false);
            dataView.setUint32(5, packetCount,false);
            dataView.setUint16(9, lookahead,false); 
            
            uint8View.set(encodedData, 11);

            const finalBuffer = recordBufferToSend.slice(0, 11 + encodedByteCount);
            
            self.postMessage({ type: 'encode', payload: finalBuffer}, [finalBuffer]);
        }
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
            self.postMessage({ type: 'decode', packet: pcm, packetCount, isRecording, recordingCount, lookahead:OPlookahead,last }, [pcm.buffer]);
        }
    }

};