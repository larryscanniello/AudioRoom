import { io, Socket } from "socket.io-client"
import { Play } from "../Events/Audio/Play";

import type { Observer } from "@/Types/Observer";
import type { DispatchEvent, GlobalContext } from "../Mediator";
import { type StateContainer } from "@/Core/State/State";
import { Stop } from "../Events/Audio/Stop";
import { StateSync } from "../Events/Sockets/StateSync";
import { EventTypes } from "../Events/EventNamespace";
import { PlayheadMoveMouseDown } from "../Events/UI/PlayheadMoveMouseDown";
import { Skipback } from "../Events/Audio/Skipback";
import { Bounce } from "../Events/Audio/Bounce";
import { RecordingFinished } from "../Events/Audio/RecordingFinished";
import { OtherPersonRecording } from "../Events/Audio/OtherPersonRecording";

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

        this.#socket.on("event_acknowledgement", ({type, state}:{type:keyof typeof EventTypes, state:StateContainer}) => {
            this.#handleEventAcknowledgement(type, state);
        });
    }

    #handleSocketEvent(type: keyof typeof EventTypes, state: StateContainer) {
        switch(type){
            case EventTypes.START_PLAYBACK:
                this.#context.dispatch(Play.getDispatchEvent({emit: false, param: null,serverMandated: true}));
                this.#context.commMessage("Partner started playback","white");
                break;
            case EventTypes.START_RECORDING:
                const newTake = state.take;
                this.#context.dispatch(OtherPersonRecording.getDispatchEvent({emit: false, param: newTake, serverMandated: true}));
                this.#context.commMessage("Partner started recording","white");
                break;
            case EventTypes.STOP:
                this.#context.dispatch(Stop.getDispatchEvent({emit: false, param: state.playheadTimeSeconds, serverMandated: true}));
                this.#context.commMessage("Partner stopped","white");
                break;
            case EventTypes.RECORDING_FINISHED:
                this.#context.dispatch(RecordingFinished.getDispatchEvent({emit: false,param:state.timeline,serverMandated: true}));
                break;
            case EventTypes.SKIPBACK:
                this.#context.dispatch(Skipback.getDispatchEvent({emit: false, param:null, serverMandated: true}));
                this.#context.commMessage("Partner moved playhead to measure 1.1","white");
                break;
            case EventTypes.CHANGE_BPM:
                // Handled by state change
                this.#context.commMessage(`Partner changed BPM to ${state.bpm}`,"white");
                break;
            case EventTypes.JOIN_SOCKET_ROOM:
                // No action needed on client receive
                this.#context.commMessage("Partner joined the session","white");
                break;
            case EventTypes.TOGGLE_LOOPING:
                // Handled by state change
                this.#context.commMessage(`Partner turned looping ${state.isLooping ? "on" : "off"}`,"white");
                break;
            case EventTypes.TOGGLE_METRONOME:
                // Handled by state change
                this.#context.commMessage(`Partner turned metronome ${state.isMetronomeOn ? "on" : "off"}`,"white");
                break;
            case EventTypes.PLAYHEAD_MOVE_MOUSE_DOWN:
                const param = state.playheadTimeSeconds;
                this.#context.dispatch(PlayheadMoveMouseDown.getDispatchEvent({emit: false, param, serverMandated: true}));
                this.#context.commMessage(`Partner moved playhead to ${this.#convertTimeToMeasures(param)}`,"white");
                break;
            case EventTypes.SET_MOUSE_DRAG_START:
                // Handled by state change
                break;
            case EventTypes.SET_MOUSE_DRAG_END:
                // Handled by state change
                const start = state.mouseDragStart.trounded;
                const end = state.mouseDragEnd ? state.mouseDragEnd.trounded : null;
                end && this.#context.commMessage(`Partner selected region ${this.#convertTimeToMeasures(start)} - ${this.#convertTimeToMeasures(end)}`,"white");
                break;
            case EventTypes.BOUNCE:
                const newTimeline = state.timeline;
                const bounce = state.bounce;
                this.#context.dispatch(Bounce.getDispatchEvent({emit: false, param: {timeline: newTimeline, bounce}, serverMandated: true}));
                this.#context.commMessage(`Partner bounced to mix`,"white");
                break;
            default:
                console.warn("Received unhandled socket event type:", type);
        }
        this.#socket.emit("event_acknowledgement", {type,state});
    }

    #handleEventAcknowledgement(type: keyof typeof EventTypes,state: StateContainer) {
        switch(type){
            case EventTypes.START_PLAYBACK:
                this.#context.commMessage("Partner audio played","white");
                break;
            case EventTypes.START_RECORDING:
                // No message
                break;
            case EventTypes.STOP:
                this.#context.commMessage("Partner stopped","white");
                break;
            case EventTypes.RECORDING_FINISHED:
                // No message
                break;   
            case EventTypes.SKIPBACK:
                this.#context.commMessage(`Partner playhead moved to measure ${this.#convertTimeToMeasures(state.playheadTimeSeconds)}`,"white");
                break;
            case EventTypes.CHANGE_BPM:
                this.#context.commMessage(`Partner BPM changed to ${state.bpm}`,"white");
                break;
            case EventTypes.TOGGLE_LOOPING:
                this.#context.commMessage(`Partner looping turned ${state.isLooping ? "on" : "off"}`,"white");
                break;
            case EventTypes.TOGGLE_METRONOME:
                this.#context.commMessage(`Partner metronome turned ${state.isMetronomeOn ? "on" : "off"}`,"white");
                break;
            case EventTypes.PLAYHEAD_MOVE_MOUSE_DOWN:
                this.#context.commMessage(`Partner playhead moved to ${this.#convertTimeToMeasures(state.playheadTimeSeconds)}`,"white");
                break;
            case EventTypes.SET_MOUSE_DRAG_START:
                // No message
                break;
            case EventTypes.SET_MOUSE_DRAG_END:
                if(!state.mouseDragEnd) break;
                this.#context.commMessage(`Partner selected region ${this.#convertTimeToMeasures(state.mouseDragStart.trounded)} - ${this.#convertTimeToMeasures(state.mouseDragEnd.trounded)}`,"white");
                break;
            case EventTypes.BOUNCE:
                this.#context.commMessage(`Partner bounced to mix`,"white");
                break;
            default:
                console.warn("Received unhandled event acknowledgement type:", type);
        }
    }

    #convertTimeToMeasures = (time: number): string => {
        const bpm = this.#context.query("bpm");
        const ts = this.#context.query("timeSignature");
        const beatsPerMeasure = ts.numerator;
        const beatsElapsed = time * (bpm / 60);
        const measure = Math.floor(beatsElapsed / beatsPerMeasure) + 1;
        const beatInMeasure = Math.floor(beatsElapsed % beatsPerMeasure) + 1;
        return `${measure}.${beatInMeasure}`;
    }

    terminate(){
        this.#socket.disconnect();
    }

}
