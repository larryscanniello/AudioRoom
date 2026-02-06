import type { Observer } from "@/Types/Observer";
import { MediaProvider } from "../MediaProvider";
import type { GlobalContext } from "../Mediator";
import type { AppEvent, EventTypes } from "../Events/AppEvent";
import { DataConnection, Peer } from "Peerjs"
import { Socket } from "socket.io-client";
import { PeerID } from "../Events/Sockets/SocketEvent";

type GainContainer = {
    local: GainNode | null,
    remote: GainNode | null,
}

export class PeerJSManager implements Observer{
    #mediaProvider: MediaProvider;
    #gainNode: GainNode | null = null;
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

    getLocalChatGain(): GainNode | null {
        return this.#chatGains.local;
    }

    getRemoteChatGain(): GainNode | null {
        return this.#chatGains.remote;
    }

    initializePeer(){
        if(this.#peer){
            throw new Error("Peer has already been initialized");
        }
        this.#peer = new Peer();

        this.#peer.on("open", peerId => {
            console.log("PeerJS open:", peerId);
            this.#context.dispatch(new PeerID(peerId));
        });

        this.#peer.on("call", call => {
            console.log("Incoming call");
            call.answer(this.#mediaProvider.getAVStream());
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
            const call = this.#peer.call(peerId, this.#mediaProvider.getAVStream());
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

    update(event:AppEvent,data?:any): void {
        
    }

    loadStream = async (): Promise<GainNode|null> => {
        this.#chatGains.local = await this.#mediaProvider.loadStream();
        if(this.#chatGains.local){
            return this.#chatGains.local;
        }
        return null;
    }

    getAVStream(): MediaStream {
        return this.#mediaProvider.getAVStream();
    }

    terminate(){
        this.#mediaProvider.terminate();
    }

}