import { io, Socket } from "socket.io-client"
import { Play } from "../Events/Audio/Play";

import type { Observer } from "@/Types/Observer";
import type { GlobalContext } from "../Mediator";
import type { AppEvent, EventTypes } from "../Events/AppEvent";
import { Stop } from "../Events/Audio/Stop";
import type { EventQueue } from "../EventQueue";


export class SocketManager implements Observer {
    #socket: Socket;
    #context!: GlobalContext;
    #eventQueue!: EventQueue;
    #isConnectedToDAW: boolean = false;
    #processEvent!: (event: AppEvent) => void;

    constructor(){
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

    update(event: AppEvent) {
        if(!this.#isConnectedToDAW){
            console.error("Not connected to DAW.");
            return;
        }
        this.#socket.emit(event.type, event.payload);
    }

    initDAWConnection(context: GlobalContext, eventQueue: EventQueue, processEvent: (event: AppEvent) => void) {
        this.#context = context;
        this.#eventQueue = eventQueue;
        this.#processEvent = processEvent;
        this.#initializeListeners();
        this.#initializeValidators();
        this.#isConnectedToDAW = true;
    }

    #initializeListeners() {
        this.#socket.on("play", () => {
            this.#context.dispatch(new Play())
            this.#context.commMessage("Partner played audio.","white");
        });

        this.#socket.on("stop", () => {
            this.#context.dispatch(new Stop())
            this.#context.commMessage("Partner stopped audio.","white");
        });

        this.#socket.on("set_bpm", (bpm: number) => {
            this.#context.dispatch(new SetBPM(bpm))
            this.#context.commMessage(`Partner changed BPM to ${bpm}.`, "white");
        });

        this.#socket.on("region_Selection", (data: any) => {
            this.#context.dispatch(new RegionSelection(data))
            this.#context.commMessage("Partner selected a region.","white");
        });

    }

    #initializeValidators() {
        this.#socket.on("validate", (id: number,status:"accepted" | "denied" | "aborted") => {
            if(!this.#processEvent){
                console.error("Process event function is not set inside SocketManager.");
            }
            if(!this.#eventQueue){
                console.error("Event queue is not set inside SocketManager.");
            }
            this.#eventQueue.updateStatus(id, status);
            this.#eventQueue.processQueue(this.#processEvent);
        })
    }

    terminate(){
        this.#socket.disconnect();
    }

}
