import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";

export const SetMouseDragEnd: EventNamespace<typeof EventTypes.SET_MOUSE_DRAG_END> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.SET_MOUSE_DRAG_END,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'mouseDragEnd', value: param }
                ],
            },
            getEventNamespace: () => { return SetMouseDragEnd; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action needed for mouse drag end
    },

    executeUI(_engine: UIEngine, _data: any): void {
        // No UI action needed for mouse drag end
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager,{transactionData, sharedSnapshot: data, type: EventTypes.SET_MOUSE_DRAG_END});
    },
};
