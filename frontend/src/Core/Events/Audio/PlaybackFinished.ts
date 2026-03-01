import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const RecordingFinished: EventNamespace<typeof EventTypes.RECORDING_FINISHED> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.RECORDING_FINISHED,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'timeline', value: param },
                ],
            },
            getEventNamespace: () => { return RecordingFinished; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        const timeline = state.query('timeline');
        return { sharedSnapshot: state.getSharedStateSnapshot(), lastRecordedRegion: timeline.lastRecordedRegion, lastMipmapRanges: timeline.lastMipmapRanges };
    },

    executeAudio(_audioEngine: WorkletAudioEngine, _data: any): void {
        //No audio action
    },

    executeUI(engine: UIEngine, data: any): void {
        for (const r of data.lastMipmapRanges) engine.renderNewRegion(r.start, r.end);
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.RECORDING_FINISHED});
    },
};