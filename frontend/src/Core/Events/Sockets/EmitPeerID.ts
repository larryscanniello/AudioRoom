import { EventTypes, type EventNamespace } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";

export const EmitPeerID: EventNamespace<typeof EventTypes.EMIT_PEER_ID> = {
    sharedState: false,

    getDispatchEvent: ({ emit, param }) => {
        return {
            type: EventTypes.EMIT_PEER_ID,
            param,
            emit,
            transactionData: {
                transactionQueries: [],
                mutations: []
            },
            getEventNamespace: () => EmitPeerID,
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

    executeSocket(socketManager: SocketManager, data: any): void {
        socketManager.emit(EventTypes.EMIT_PEER_ID, { peerID: data.peerID });
    },
};
