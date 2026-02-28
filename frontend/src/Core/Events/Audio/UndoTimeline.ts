import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const UndoTimeline: EventNamespace<typeof EventTypes.UNDO_TIMELINE> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.UNDO_TIMELINE,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'timeline', value: param }],
            },
            getEventNamespace: () => { return UndoTimeline; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return { snapshot: state.getSnapshot(), sharedSnapshot: state.getSharedStateSnapshot(), lastMipmapRanges: state.query('timeline').lastMipmapRanges };
    },

    executeAudio(_audioEngine: WorkletAudioEngine, _data: any): void {
        // No audio action
    },

    executeUI(engine: UIEngine, data: any): void {
        for (const r of data.lastMipmapRanges) engine.renderNewRegion(r.start, r.end);
        engine.draw([
            DOMCommands.DRAW_TRACK_ONE_WAVEFORMS,
            DOMCommands.DRAW_TRACK_TWO_WAVEFORMS,
            DOMCommands.RENDER_TRACK_ONE_REGIONS,
            DOMCommands.RENDER_TRACK_TWO_REGIONS,
        ], data.snapshot);
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.UNDO_TIMELINE });
    },
};