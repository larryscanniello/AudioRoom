import type { State } from "@/Core/State";
import type { AppEvent } from "../EventNamespace";


export abstract class SocketEvent implements AppEvent{
    abstract readonly type: string;
    readonly payload: any;
    
    constructor(){
    }

    canExecute(_state: State): "process" | "queue" | "denied" {
        return "process";
    }

    abstract mutateState(_state: State): void;

    abstract getPayload(_state: State): any;
}

export class PeerID extends SocketEvent {
    readonly type = "peerjs-signaling";
    readonly peerID: string;

    constructor(peerID: string){
        super();
        this.peerID = peerID;
    }

    mutateState(_state: State): void {
        
    }

    getPayload(state: State) {
        const roomID = state.query('roomID');
        return {roomID,peerID:this.peerID};
    }

 }

export class SocketCallPeerCallback extends SocketEvent {
    readonly type = "call-peer-callback";
    readonly peerID: string;
    readonly callback: (peerID: string) => void;

    constructor(peerID: string, callback: (peerID: string) => void){
        super();
        this.peerID = peerID;
        this.callback = callback;
    }

    mutateState(_state: State): void {
        
    }

    getPayload(state: State) {
        const roomID = state.query('roomID');
        return {roomID,peerID:this.peerID,callback:this.callback};
    }

 }