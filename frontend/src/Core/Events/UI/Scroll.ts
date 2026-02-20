import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const Scroll: EventNamespace<typeof EventTypes.SCROLL> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.SCROLL,
            emit,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'viewport', value: param }
                ],
            },
            getEventNamespace: () => { return Scroll; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action needed
    },

    executeUI(engine: UIEngine, data: any): void {
        engine.draw(Object.values(DOMCommands), data);
    },

    executeSocket(_socketManager: any, _transactionData: TransactionData, _data: any): void {
        // No socket action needed
    },
};
