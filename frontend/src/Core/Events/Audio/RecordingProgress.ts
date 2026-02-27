import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const RecordingProgress: EventNamespace<typeof EventTypes.RECORDING_PROGRESS> = {
    sharedState: true,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.RECORDING_PROGRESS,
            emit,
            param,
            serverMandated,
            transactionData: {
                transactionQueries: [{key: 'isRecording', comparitor: '===', target: true}],
                mutations: [{ key: 'liveRecording', value: param}],
            },
            getEventNamespace: () => { return RecordingProgress; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_audioEngine: WorkletAudioEngine, _data: any): void {
        //No audio action
    },

    executeUI(_engine: UIEngine, _data: any): void {
        
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data, type: EventTypes.RECORDING_PROGRESS});
    },
};