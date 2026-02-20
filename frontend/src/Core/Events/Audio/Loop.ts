import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

export const Loop: EventNamespace<typeof EventTypes.TOGGLE_LOOPING> = {
    sharedState: true,

    getDispatchEvent: ({ emit, serverMandated }) => { return {
            type: EventTypes.TOGGLE_LOOPING,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    { key: 'isRecording', comparitor: '===', target: false },
                    { key: 'isPlaying', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'isLooping', value: 'toggle' },
                ]
            },
            getEventNamespace: () => { return Loop; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return { type: EventTypes.TOGGLE_LOOPING, isLooping: state.query('isLooping') };
    },

    executeAudio(_engine: AudioEngine,_data:any): void {
        // No audio engine action required for toggling looping
    },

    executeUI(_engine: UIEngine,_data:any): void {
        //No specific UI action required for toggling looping, as the playhead behavior will be updated through state changes
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};
