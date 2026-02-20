import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

export const Skipback: EventNamespace<typeof EventTypes.SKIPBACK> = {
    sharedState: true,

    getDispatchEvent: ({ emit,serverMandated }) => { return {
            type: EventTypes.SKIPBACK,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    { key: 'isRecording', comparitor: '===', target: false },
                    { key: 'isPlaying', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'playheadTimeSeconds', value: 0 },
                    { key: 'mouseDragStart', value: { t: 0, trounded: 0 } },
                    { key: 'mouseDragEnd', value: null },
                ]
            },
            getEventNamespace: () => { return Skipback; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_engine: AudioEngine, _data:any ): void {
        // No audio engine action required for Skipback
    },

    executeUI(_engine: UIEngine, _data:any): void {
        // No specific UI action required for Skipback, as the playhead position will be updated through state changes
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data, type: EventTypes.SKIPBACK});
    },
};