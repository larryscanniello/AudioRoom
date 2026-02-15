import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";

export const ChangeBPM: EventNamespace<typeof EventTypes.CHANGE_BPM> = {
    sharedState: true,

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.CHANGE_BPM,
            emit,
            transactionData: {
                transactionQueries: [
                    { key: 'isPlaying', comparitor: '===', target: false },
                    { key: 'isRecording', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'bpm', value: param }
                ],
            },
            getEventNamespace: () => { return ChangeBPM; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
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

    executeSocket(socketManager: any, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};
