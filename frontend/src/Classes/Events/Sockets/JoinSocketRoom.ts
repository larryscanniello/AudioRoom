import { EventTypes, type EventNamespace } from "../EventNamespace";
import type { State, StateContainer } from "@/Classes/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { AudioEngine } from "@/Classes/Audio/AudioEngine";
import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Classes/UI/UIEngine";
import type { SocketManager } from "@/Classes/Sockets/SocketManager";

export const JoinSocketRoom:EventNamespace = {
    sharedState: true,

    transactionData: {
        transactionQueries: [],
        mutations: []
    },

    getDispatchEvent: (roomID:string) => { return { 
            type: EventTypes.JOIN_SOCKET_ROOM,
            data: {roomId: roomID},
            getEventNamespace:()=>JoinSocketRoom,
        }},
    
    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
    },

    getLocalPayload(state: State): StateContainer {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: AudioEngine,_data:AudioProcessorData): void {
        // No action needed
    },

    executeUI(_engine: UIEngine,_data:AudioProcessorData): void {
        // No action needed
    },

    executeSocket(socketManager: SocketManager, data:any): void {
        socketManager.emit(EventTypes.JOIN_SOCKET_ROOM, {roomID: data.roomID, state: data.state});
    },
};