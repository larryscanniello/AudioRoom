import type { Observer } from "@/Types/Observer";
import { MediaProvider } from "../MediaProvider";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { Peer } from "Peerjs"
import type { DataConnection } from "Peerjs"; 
import { Socket } from "socket.io-client";
import { JoinSocketRoom } from "../Events/Sockets/JoinSocketRoom";
import { EmitPeerID } from "../Events/Sockets/EmitPeerID";

type GainContainer = {
    local: GainNode | null,
    remote: GainNode | null,
}

export class PeerJSManager implements Observer{
    #mediaProvider: MediaProvider;
    //#gainNode: GainNode | null = null;
    #chatGains: GainContainer = {local:null,remote:null};
    #context: GlobalContext;
    #socketManager: Socket;
    #dataChannel: DataConnection | null = null;
    #peer: Peer|undefined = undefined;
    
    constructor(mediaProvider:MediaProvider,context:GlobalContext,socketManager: Socket){ 
        this.#mediaProvider = mediaProvider;
        this.#context = context;
        this.#socketManager = socketManager;
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
        });
        
    }

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