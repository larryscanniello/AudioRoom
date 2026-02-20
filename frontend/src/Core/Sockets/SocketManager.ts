import { io, Socket } from "socket.io-client"
import { Play } from "../Events/Audio/Play";

import type { Observer } from "@/Types/Observer";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import type { Mutation, StateContainer } from "@/Core/State/State";
import { Stop } from "../Events/Audio/Stop";
import { StateSync } from "../Events/Sockets/StateSync";
import { EventTypes } from "../Events/EventNamespace";
import { PlayheadMoveMouseDown } from "../Events/UI/PlayheadMoveMouseDown";

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
        this.#socket.on("event", ({type, state}:{type:keyof typeof EventTypes, state:StateContainer}) => {
            this.#context.dispatch(StateSync.getDispatchEvent({emit: false,param:state}));
            this.#handleSocketEvent(type, state);
        });
    }

    #handleSocketEvent(type: keyof typeof EventTypes, state: StateContainer) {
        switch(type){
            case EventTypes.START_PLAYBACK:
                this.#context.dispatch(Play.getDispatchEvent({emit: false, serverMandated: true}));
                break;
            case EventTypes.STOP:
                this.#context.dispatch(Stop.getDispatchEvent({emit: false, serverMandated: true}));
                break;
            case EventTypes.PLAYHEAD_MOVE_MOUSE_DOWN:
                this.#context.dispatch(PlayheadMoveMouseDown.getDispatchEvent({emit: false, serverMandated: true}));
                break;
        }
                
                
    }

    terminate(){
        this.#socket.disconnect();
    }

}
