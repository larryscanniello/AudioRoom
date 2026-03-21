import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const UpdateRegionOffset: EventNamespace<typeof EventTypes.UPDATE_REGION_OFFSET> = {
    sharedState: true,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.UPDATE_REGION_OFFSET,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'timeline', value: param },
                    { key: 'liveSlip', value: null },
                ],
            },
            getEventNamespace: () => { return UpdateRegionOffset; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        const timeline = state.query('timeline');
        return {
            snapshot: state.getSnapshot(),
            sharedSnapshot: state.getSharedStateSnapshot(),
            lastMipmapRanges: timeline.lastMipmapRanges,
        };
    },

    executeAudio(_audioEngine: WorkletAudioEngine, _data: any): void {
        // No direct audio engine action; mipmap rebuild is handled in executeUI
    },

    executeUI(engine: UIEngine, data: any): void {
        for (const r of data.lastMipmapRanges) engine.renderNewRegionForSlip(r.start, r.end);
        if (data.lastMipmapRanges.length === 0) engine.clearLiveSlip();
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.UPDATE_REGION_OFFSET });
    },
};
