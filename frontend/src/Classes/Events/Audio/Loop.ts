import { EventTypes } from "../EventNamespace";
import type { State } from "@/Classes/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Classes/UI/UIEngine";
import type { SocketManager } from "@/Classes/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Classes/Audio/AudioEngine";

export const Loop: EventNamespace = {
    sharedState: true,

    transactionData: {
        transactionQueries: [
            { key: 'isRecording', comparitor: '===', target: false },
            { key: 'isPlaying', comparitor: '===', target: false },
        ],
        mutations: [
            { key: 'isLooping', value: 'toggle' },
        ]
    },

    getDispatchEvent: ({ data, emit }) => { return {
            type: EventTypes.TOGGLE_LOOPING,
            data,
            emit,
            getEventNamespace: () => { return Loop; }
        }},

    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
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

    executeSocket(socketManager: SocketManager, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};
