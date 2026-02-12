import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";

export const Skipback: EventNamespace<typeof EventTypes.SKIPBACK> = {
    sharedState: true,

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

    getDispatchEvent: ({ emit }) => { return {
            type: EventTypes.SKIPBACK,
            param: null,
            emit,
            getEventNamespace: () => { return Skipback; }
        }},

    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
    },

    getLocalPayload(_state: State) {
        return { type: EventTypes.SKIPBACK };
    },

    executeAudio(_engine: AudioEngine, _data:any ): void {
        // No audio engine action required for Skipback
    },

    executeUI(_engine: UIEngine, _data:any): void {
        // No specific UI action required for Skipback, as the playhead position will be updated through state changes
    },

    executeSocket(socketManager: SocketManager, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};