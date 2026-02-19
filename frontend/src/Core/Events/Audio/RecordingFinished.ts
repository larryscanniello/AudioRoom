
import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const RecordingFinished: EventNamespace<typeof EventTypes.RECORDING_FINISHED> = {
    sharedState: true,

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.RECORDING_FINISHED,
            emit,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'timeline', value: param }],
            },
            getEventNamespace: () => { return RecordingFinished; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): any {
        return null;
    },

    executeAudio(_audioEngine: WorkletAudioEngine, _data: any): void {

    },

    executeUI(engine: UIEngine, _data: any): void {
        engine.renderNewRegion();
    },

    executeSocket(socketManager: any, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};