import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";

export const SetMouseDragStart: EventNamespace<typeof EventTypes.SET_MOUSE_DRAG_START> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.SET_MOUSE_DRAG_START,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'mouseDragStart', value: param }
                ],
            },
            getEventNamespace: () => { return SetMouseDragStart; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action needed for mouse drag start
    },

    executeUI(_engine: UIEngine, _data: any): void {
        // No UI action needed for mouse drag start
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data, type: EventTypes.SET_MOUSE_DRAG_START  });
    },
};
