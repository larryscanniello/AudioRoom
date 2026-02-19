import { io, Socket } from "socket.io-client"
import { Play } from "../Events/Audio/Play";

import type { Observer } from "@/Types/Observer";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { EventTypes } from "../Events/EventNamespace";
import type { Mutation, StateContainer } from "@/Core/State/State";
import { Stop } from "../Events/Audio/Stop";

import socketOns from "./socketOns";
import { Slottable } from "@radix-ui/react-slot";

export class SocketManager implements Observer {
    #socket: Socket;
    #context: GlobalContext;
    #isConnectedToDAW: boolean = false;

    constructor(context: GlobalContext){
        this.#context = context;
        this.#socket = io(import.meta.env.VITE_BACKEND_URL, {
              withCredentials: true,
        });
    }

    getSocket() {
        return this.#socket;
    }

    on(name:string, callback: (...args: any[]) => void){
        this.#socket.on(name, callback);
    }

    emit(socketKey: string, data: any) {
        this.#socket.emit(socketKey, data);
    }

    update(event: DispatchEvent, data:any): void {
        console.log("SocketManager received event:", event.type, "with data:", data);
        if(!this.#isConnectedToDAW){
            throw new Error("Cannot process socket event before connection to DAW is initialized.");
        }
        const namespace = event.getEventNamespace();
        namespace.executeSocket(this, data, event.transactionData);
    }

    initDAWConnection() {
        this.#initializeListeners();
        this.#isConnectedToDAW = true;
    }

    #initializeListeners() {
        this.#socket.on("sync_state", ({mutations}:{mutations:Mutation<keyof StateContainer>[]}) => {
            this.#handleStateSync(mutations);
        });

        

        socketOns(this.#socket, this.#context);
    }

    #handleStateSync(mutations: Mutation<keyof StateContainer>[]) {
        for(let mutation of mutations){
            const currStateVal = this.#context.query(mutation.key);
            if(currStateVal !== mutation.value){
                this.#handleStateSyncMutation(mutation);
            }
        }
        
    }

    #handleStateSyncMutation(mutation: Mutation<keyof StateContainer>) {
        switch(mutation.key){
            case "isPlaying":
                if(mutation.value === false){
                    this.#context.dispatch(Stop.getDispatchEvent());
                    this.#context.commMessage("Partner stopped audio.","white");
                }else{
                    this.#context.dispatch(Play.getDispatchEvent());
                    this.#context.commMessage("Partner played audio.","white");
                }
                break;
            case "isRecording":
                if(mutation.value === false){
                    this.#context.dispatch(Stop.getDispatchEvent()); 
                    this.#context.commMessage("Partner stopped recording.","white");
                }else{
                    this.#context.dispatch(PartnerRecording.getDispatchEvent()); 
                    this.#context.commMessage("Partner started recording.","white");
                }
                break;
            case "playheadLocation":
                this.#context.dispatch(SetPlayheadLocation.getDispatchEvent(mutation.value));
                break;
            case "numConnectedUsers":
                this.#context.dispatch(SetNumConnectedUsers.getDispatchEvent(mutation.value));
                break;
            case "mouseDragEnd":
                this.#context.dispatch(RegionSelection.getDispatchEvent(mutation.value));
                break;
        }
                
                
    }

    terminate(){
        this.#socket.disconnect();
    }

}
