import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const DeleteMixBounces: EventNamespace<typeof EventTypes.DELETE_MIX_BOUNCES> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.DELETE_MIX_BOUNCES,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'timeline', value: param }],
            },
            getEventNamespace: () => { return DeleteMixBounces; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return { snapshot: state.getSnapshot(), sharedSnapshot: state.getSharedStateSnapshot() };
    },

    executeAudio(engine: WorkletAudioEngine, data: any): void {
        engine.regenerateMixMipmap({
            type: "regenerate_mix_mipmap",
            newMixTimelines: data.snapshot.timeline.mix,
        });
    },

    executeUI(engine: UIEngine, data: any): void {
        engine.draw([
            DOMCommands.DRAW_TRACK_TWO_WAVEFORMS,
            DOMCommands.RENDER_TRACK_TWO_REGIONS,
        ], data.snapshot);
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.DELETE_MIX_BOUNCES });
    },
};