import { io, Socket } from "socket.io-client"
import { Play } from "../Events/Audio/Play";

import type { Observer } from "@/Types/Observer";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { State, type Mutation, type StateContainer } from "@/Core/State/State";
import { Stop } from "../Events/Audio/Stop";
import { StateSync } from "../Events/Sockets/StateSync";
import { EventTypes } from "../Events/EventNamespace";
import { PlayheadMoveMouseDown } from "../Events/UI/PlayheadMoveMouseDown";
import { Skipback } from "../Events/Audio/Skipback";
import { Bounce } from "../Events/Audio/Bounce";
import { RecordingFinished } from "../Events/Audio/RecordingFinished";

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
        if(!this.#isConnectedToDAW){
            throw new Error("Cannot process socket event before connection to DAW is initialized.");
        }
        if(!event.emit) return;
        const namespace = event.getEventNamespace();
        namespace.executeSocket(this, event.transactionData, data);
    }

    initDAWConnection() {
        this.#initializeListeners();
        this.#isConnectedToDAW = true;
    }

    #initializeListeners() {
        this.#socket.on("event", ({type, state}:{type:keyof typeof EventTypes, state:StateContainer}) => {
            this.#context.dispatch(StateSync.getDispatchEvent({emit: false,param:state,serverMandated: true}));
            this.#handleSocketEvent(type, state);
        });
    }

    #handleSocketEvent(type: keyof typeof EventTypes, state: StateContainer) {
        switch(type){
            case EventTypes.START_PLAYBACK:
                this.#context.dispatch(Play.getDispatchEvent({emit: false, param: null,serverMandated: true}));
                break;
            case EventTypes.START_RECORDING:
                // big task to do later
                break;
            case EventTypes.STOP:
                this.#context.dispatch(Stop.getDispatchEvent({emit: false, param: state.playheadTimeSeconds, serverMandated: true}));
                break;
            case EventTypes.RECORDING_FINISHED:
                this.#context.dispatch(RecordingFinished.getDispatchEvent({emit: false,param:state.timeline,serverMandated: true}));
                break;
            case EventTypes.SKIPBACK:
                this.#context.dispatch(Skipback.getDispatchEvent({emit: false, param:null, serverMandated: true}));
                break;
            case EventTypes.CHANGE_BPM:
                // Handled by state change
                break;
            case EventTypes.JOIN_SOCKET_ROOM:
                // No action needed on client receive
                break;
            case EventTypes.TOGGLE_LOOPING:
                // Handled by state change
                break;
            case EventTypes.TOGGLE_METRONOME:
                // Handled by state change
                break;
            case EventTypes.PLAYHEAD_MOVE_MOUSE_DOWN:
                const param = state.playheadTimeSeconds;
                this.#context.dispatch(PlayheadMoveMouseDown.getDispatchEvent({emit: false, param, serverMandated: true}));
                break;
            case EventTypes.SET_MOUSE_DRAG_START:
                // Handled by state change
                break;
            case EventTypes.SET_MOUSE_DRAG_END:
                // Handled by state change
                break;
            case EventTypes.BOUNCE:
                const newTimeline = state.timeline;
                this.#context.dispatch(Bounce.getDispatchEvent({emit: false, param: newTimeline, serverMandated: true}));
                break;
            default:
                console.warn("Received unhandled socket event type:", type);
        }
    }

    terminate(){
        this.#socket.disconnect();
    }

}
