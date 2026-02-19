import { MediaProvider } from "../MediaProvider";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { Peer } from "Peerjs"
import type { DataConnection } from "Peerjs"; 
import { Socket } from "socket.io-client";
import { JoinSocketRoom } from "../Events/Sockets/JoinSocketRoom";
import { EmitPeerID } from "../Events/Sockets/EmitPeerID";
import type { WebRTCManager } from "./WebRTCManager";
import type { AudioProcessorData, DecodeAudioData } from "@/Types/AudioState";

type GainContainer = {
    local: GainNode | null,
    remote: GainNode | null,
}

export class PeerJSManager implements WebRTCManager{
    #mediaProvider: MediaProvider;
    //#gainNode: GainNode | null = null;
    #chatGains: GainContainer = {local:null,remote:null};
    #context: GlobalContext;
    #socketManager: Socket;
    #dataChannel: DataConnection | null = null;
    #peer: Peer|undefined = undefined;
    #opusWorker: Worker;
    
    constructor(mediaProvider:MediaProvider,context:GlobalContext,socketManager: Socket,opusWorker: Worker) { 
        this.#mediaProvider = mediaProvider;
        this.#context = context;
        this.#socketManager = socketManager;
        this.#opusWorker = opusWorker;
        this.#opusWorker.onmessage = this.#opusWorkerOnMessage.bind(this);
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

    record(data:AudioProcessorData){
        this.#opusWorker.postMessage(data);
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
      const joinRoomEvent = JoinSocketRoom.getDispatchEvent({emit:true, param:{roomID}});
      this.#context.dispatch(joinRoomEvent)
    }

    initializePeer(){
        if(this.#peer){
            throw new Error("Peer has already been initialized");
        }
        this.#peer = new Peer();

        this.#peer.on("open", peerId => {
            console.log("PeerJS open:", peerId);
            this.#context.dispatch(EmitPeerID.getDispatchEvent({emit:true, param:{peerID: peerId}}));
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
            this.#dataChannel.on("data", (data:any) => this.#dataChannelOnCallback(data));
        });
    }

    #dataChannelOnCallback = (data: ArrayBuffer) => {
        const buffer = data; // confirmed ArrayBuffer
        const view = new DataView(buffer);

        // Byte 0: Flags (Uint8)
        const flags = view.getUint8(0);
        const isRecording = (flags & 0x01) !== 0;
        const last = (flags & 0x02) !== 0;

        // Bytes 1-4: recordingCount (Uint32)
        const recordingCount = view.getUint32(1, false); 
        
        // Bytes 5-8: packetCount (Uint32)
        const packetCount = view.getUint32(5, false);
        
        // Bytes 9-10: lookahead (Uint16)
        const lookahead = view.getUint16(9, false);

        // Byte 11 onwards: The Opus Packet
        // We slice here because we need a separate buffer to 'transfer' to the worker
        const packet = buffer.slice(11);

        const uintview = new Uint8Array(packet);

        this.#opusWorker.postMessage({
            type: "decode",
            packetCount,
            recordingCount,
            packet:uintview,
            isRecording,
            OPlookahead: lookahead,
            last
        }, [packet]); 
    
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

    update(_event:DispatchEvent,_data?:any): void {
        // Handle any events that need to be handled by PeerJSManager here
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