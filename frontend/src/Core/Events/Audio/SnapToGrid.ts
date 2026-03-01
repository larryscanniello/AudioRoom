
import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

    export const ToggleSnapToGrid: EventNamespace<typeof EventTypes.TOGGLE_SNAP_TO_GRID> = {
    sharedState: true,

    getDispatchEvent: ({ emit,param,serverMandated }) => { return {
            type: EventTypes.TOGGLE_SNAP_TO_GRID,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'snapToGrid', value: param }],
            },
            getEventNamespace: () => { return ToggleSnapToGrid; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_engine: AudioEngine, _data:any ): void {
        // No audio engine action required for ToggleSnapToGrid
    },

    executeUI(_engine: UIEngine, _data:any): void {
        // No specific UI action required for ToggleSnapToGrid
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data, type: EventTypes.TOGGLE_SNAP_TO_GRID});
    },
};