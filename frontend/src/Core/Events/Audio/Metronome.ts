import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

export const Metronome: EventNamespace<typeof EventTypes.TOGGLE_METRONOME> = {
    sharedState: true,

    getDispatchEvent: ({ emit,serverMandated }) => { return {
            type: EventTypes.TOGGLE_METRONOME,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    { key: 'isMetronomeOn', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'isMetronomeOn', value: 'toggle' },
                ]
            },
            getEventNamespace: () => { return Metronome; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return { type: EventTypes.TOGGLE_METRONOME, isMetronomeOn: state.query('isMetronomeOn') };
    },

    executeAudio(_audioEngine: AudioEngine, _data: any): void {
        //add later
    },

    executeUI(_engine: UIEngine, _data: any): void {
        // No specific UI action required for toggling the metronome
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};
