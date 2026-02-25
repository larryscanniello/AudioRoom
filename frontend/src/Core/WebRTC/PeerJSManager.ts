import { MediaProvider } from "../MediaProvider";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { Peer } from "Peerjs"
import type { DataConnection } from "Peerjs"; 
import { JoinSocketRoom } from "../Events/Sockets/JoinSocketRoom";
import type { WebRTCManager } from "./WebRTCManager";
import { RemoteStreamAttached } from "../Events/WebRTC/RemoteStreamAttached";
import type { SocketManager } from "../Sockets/SocketManager";
import type { Buffers, Pointers } from "@/Workers/opfs_utils/types";
import { EventTypes } from "../Events/EventNamespace";
import type { AudioProcessorData } from "@/Types/AudioState";


type GainContainer = {
    local: GainNode | null,
    remote: GainNode | null,
}

type Hardware = {
    opusWorker: Worker,
    memory: {
        pointers: Pointers,
        buffers: Buffers,
    }
}

export class PeerJSManager implements WebRTCManager{
    #mediaProvider: MediaProvider;
    //#gainNode: GainNode | null = null;
    #chatGains: GainContainer = {local:null,remote:null};
    #context: GlobalContext;
    #socketManager: SocketManager;
    #dataChannel: DataConnection | null = null;
    #peer: Peer|undefined = undefined;
    #hardware: Hardware;

    constructor(mediaProvider:MediaProvider,context:GlobalContext,socketManager:SocketManager,hardware:Hardware) { 
        this.#mediaProvider = mediaProvider;
        this.#context = context;
        this.#socketManager = socketManager;
        this.#hardware = hardware;
        this.#hardware.opusWorker.onmessage = this.#opusWorkerOnMessage.bind(this);
    }

    #opusWorkerOnMessage(e: MessageEvent){
        switch(e.data.type){
            case "encode":
                if(this.#dataChannel && this.#dataChannel.open){
                    this.#dataChannel.send(e.data.packet);
                }else{
                    console.warn("Data channel not open, cannot send encoded audio packet");
                }
                break;
            case "decode":
                this.#mediaProvider.receivePacket(e.data);
                break;
            default:
                console.warn(`Unrecognized message from Opus worker: ${e.data.type}`);
        }
    }

    record(data: AudioProcessorData){
        this.#hardware.opusWorker.postMessage(data);
    }

    stop(){
        this.#hardware.opusWorker.postMessage({type:EventTypes.STOP});
    }

    getRemoteStream(): MediaStream | null {
        return this.#mediaProvider.getRemoteStream();
    }

    getLocalStream(): MediaStream | null{
        return this.#mediaProvider.getAVStream();
    }

    getLocalChatGain(): GainNode | null {
        return this.#chatGains.local;
    }

    getRemoteChatGain(): GainNode | null {
        return this.#chatGains.remote;
    }

    getDataChannel(): DataConnection | null {
        return this.#dataChannel;
    }

    joinSocketRoom(roomID: string){
      this.#context.dispatch(JoinSocketRoom.getDispatchEvent({emit:true, param:roomID}));
    }

    initializeOpus(){
        this.#hardware.opusWorker.postMessage({type: "initAudio", memory: this.#hardware.memory});
    }

    initializePeer(){
        if(this.#peer){
            throw new Error("Peer has already been initialized");
        }
        this.#peer = new Peer();

        this.#peer.on("open", peerID => {
            console.log("PeerJS open:", peerID);
            this.#socketManager.emit("EMIT_PEER_ID", {peerID});
        });

        this.#peer.on("call", call => {
            console.log("Incoming call");
            const avStream = this.#mediaProvider.getAVStream();
            if(!avStream){
                console.error("No AV stream available to answer call");
                return;
            }
            call.answer(avStream);
            this.#attachCallHandlers(call);
        });

        this.#peer.on("connection", conn => {
          console.log("Incoming data channel");

          conn.on("open", () => {
            console.log("Data channel open (callee)");
            this.#dataChannel = conn;
            this.#dataChannel.on("data", (data:any) => this.#dataChannelOnCallback(data));
          });

          conn.on("close", () => {
            this.#dataChannel = null;
          });
        });

        this.#socketManager.on("call-peer", (peerId) => {
            if(!this.#peer){
              throw new Error("Call-peer callback: No peer object initialized");
            }
            console.log("Calling peer:", peerId);
            const avStream = this.#mediaProvider.getAVStream();
            if(!avStream){
                console.error("No AV stream available to call peer");
                return;
            }
            const call = this.#peer.call(peerId, avStream);
            this.#attachCallHandlers(call);
            const conn = this.#peer.connect(peerId, {
              reliable: false,
            });
            this.#dataChannel = conn;
            console.log("Data channel open (caller)");
            this.#dataChannel.on("data", (data:any) => this.#dataChannelOnCallback(data));
        });

    }

    #dataChannelOnCallback = (data: ArrayBuffer) => {
    const buffer = data;
    const view = new DataView(buffer);

    // Byte 0: flags
    const flags = view.getUint8(0);
    const isRecording = (flags & 0x01) !== 0;
    const last = (flags & 0x02) !== 0;

    // Bytes 1-2: bounce (Uint16, BE)
    const bounce = view.getUint16(1, false);

    // Bytes 3-4: take (Uint16, BE)
    const take = view.getUint16(3, false);

    // Bytes 5-8: packetCount (Uint32, BE)
    const packetCount = view.getUint32(5, false);

    // Bytes 9-10: lookahead (Uint16, BE)
    const lookahead = view.getUint16(9, false);

    // Byte 11+: opus packet (copy so transfer is safe)
    const packetBuffer = buffer.slice(11);
    const packet = new Uint8Array(packetBuffer);

    this.#hardware.opusWorker.postMessage(
        {
            type: "decode",
            packetCount,
            bounce,
            take,
            packet,
            isRecording,
            OPlookahead: lookahead,
            last,
        },
        [packetBuffer]
    );
};
    

    #attachCallHandlers = (call:any)=> {
        call.on("stream", (incomingStream:MediaStream) => {
          console.log("Received remote stream");
          this.#mediaProvider.setRemoteStream(incomingStream); 
          const ctx = this.#mediaProvider.getAudioContext();
          const remoteSource = ctx.createMediaStreamSource(incomingStream);
          const remoteGain = ctx.createGain();
          this.#chatGains.remote = remoteGain
          remoteSource.connect(remoteGain);
          remoteGain.connect(ctx.destination);
          this.#context.dispatch(RemoteStreamAttached.getDispatchEvent({emit: false, param: true}));
        });

        call.on("close", () => {
          this.#mediaProvider.setRemoteStream(null);
        });

        this.#socketManager.on("user_disconnected_server_to_client",()=>{
          this.#mediaProvider.setRemoteStream(null);
        })

        call.on("error", (err:any) => {
          this.#context.commMessage("Error with video","red");
          console.error("Call error:", err);
        });
      }

    update(event:DispatchEvent,data:any): void {
        const namespace = event.getEventNamespace();
        if(namespace.executeRTC){   
            namespace.executeRTC(this, data);
        }
        
    }

    loadStream = async (): Promise<GainNode|null> => {
        this.#chatGains.local = await this.#mediaProvider.loadStream();
        if(this.#chatGains.local){
            return this.#chatGains.local;
        }
        return null;
    }

    getAVStream(): MediaStream {
      const avstream = this.#mediaProvider.getAVStream(); 
        if(!avstream){
            throw new Error("No AV stream available");
        }
        return avstream;
    }

    terminate(){
        this.#mediaProvider.terminate();
    }

}