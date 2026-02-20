import { EventTypes, type EventNamespace } from "../EventNamespace";
import type { State, StateContainer, TransactionData } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";

export const JoinSocketRoom: EventNamespace<typeof EventTypes.JOIN_SOCKET_ROOM> = {
    sharedState: false,

    getDispatchEvent: ({ emit, param,serverMandated }) => {
        return {
            type: EventTypes.JOIN_SOCKET_ROOM,
            param,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'roomID', value: param }]
            },
            getEventNamespace: () => JoinSocketRoom,
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Partial<StateContainer> {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_audioEngine: AudioEngine,_data:AudioProcessorData): void {
        // No action needed
    },

    executeUI(_engine: UIEngine,_data:AudioProcessorData): void {
        // No action needed
    },

    executeSocket(socketManager: SocketManager, _transactionData: any, data: Partial<StateContainer>): void {
        socketManager.emit(EventTypes.JOIN_SOCKET_ROOM, data);
    },
};