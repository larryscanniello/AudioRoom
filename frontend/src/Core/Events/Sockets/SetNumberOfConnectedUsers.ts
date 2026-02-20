import { EventTypes, type EventNamespace } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";

export const SetNumConnectedUsers: EventNamespace<typeof EventTypes.SET_NUMBER_OF_CONNECTED_USERS> = {
    sharedState: false,

    getDispatchEvent: ({ emit, param,serverMandated }) => {
        return {
            type: EventTypes.SET_NUMBER_OF_CONNECTED_USERS,
            param,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [{key: 'numConnectedUsers', value: param}]
            },
            getEventNamespace: () => SetNumConnectedUsers,
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): null {
        return null;
    },

    executeAudio(_audioEngine: AudioEngine, _data: AudioProcessorData): void {
        // No action needed
    },

    executeUI(_engine: UIEngine, _data: AudioProcessorData): void {
        // No action needed
    },

    executeSocket(_socketManager: SocketManager, _data: any): void {
        //
    },
};
