import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";

export const ChangeBPM: EventNamespace<typeof EventTypes.CHANGE_BPM> = {
    sharedState: true,

    transactionData: {
        transactionQueries: [],
        mutations: [],
    },

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.CHANGE_BPM,
            param,
            emit,
            getEventNamespace: () => { return ChangeBPM; }
        };
    },

    stateTransaction(state: State, stateUpdateParam: number): boolean {
        const transactionData: TransactionData = {
            transactionQueries: [
                { key: 'isPlaying', comparitor: '===', target: false },
                { key: 'isRecording', comparitor: '===', target: false },
            ],
            mutations: [
                { key: 'bpm', value: stateUpdateParam }
            ],
        };
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action needed for BPM change
    },

    executeUI(_engine: UIEngine, _data: { bpm: number }): void {
        // No specific UI engine action needed; handled by react state rerender
    },

    executeSocket(socketManager: any, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};
