import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";

export const Metronome: EventNamespace<typeof EventTypes.TOGGLE_METRONOME> = {
    sharedState: true,

    transactionData: {
        transactionQueries: [
            { key: 'isMetronomeOn', comparitor: '===', target: false },
        ],
        mutations: [
            { key: 'isMetronomeOn', value: 'toggle' },
        ]
    },

    getDispatchEvent: ({ emit }) => { return {
            type: EventTypes.TOGGLE_METRONOME,
            param: null,
            emit,
            getEventNamespace: () => { return Metronome; }
        }},

    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
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

    executeSocket(socketManager: SocketManager, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};
