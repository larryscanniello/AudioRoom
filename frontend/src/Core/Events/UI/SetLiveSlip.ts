import { EventTypes } from "../EventNamespace";
import type { State, StateContainer, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const SetLiveSlip: EventNamespace<typeof EventTypes.SET_LIVE_SLIP> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.SET_LIVE_SLIP,
            emit,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'liveSlip', value: param }],
            },
            getEventNamespace: () => { return SetLiveSlip; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): StateContainer {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action
    },

    executeUI(engine: UIEngine, data: StateContainer): void {
        engine.draw([DOMCommands.DRAW_TRACK_ONE_WAVEFORMS], data);
    },

    executeSocket(_socketManager: any, _transactionData: TransactionData, _data: any): void {
        // Not emitted to server
    },
};
