import { EventTypes } from "../EventNamespace";
import type { State, StateContainer, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const DrawAllCanvases: EventNamespace<typeof EventTypes.DRAW_ALL_CANVASES> = {
    sharedState: false,

    getDispatchEvent: ({ emit }) => {
        return {
            type: EventTypes.DRAW_ALL_CANVASES,
            emit,
            transactionData: {
                transactionQueries: [],
                mutations: [],
            },
            getEventNamespace: () => { return DrawAllCanvases; }
        };
    },

    stateTransaction(_state: State, _transactionData: TransactionData): boolean {
        // No state transaction needed for this event
        return true;
    },

    getLocalPayload(state: State): StateContainer {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action needed
    },

    executeUI(engine: UIEngine, data: StateContainer): void {
        engine.draw(Object.values(DOMCommands), data);
    },

    executeSocket(_socketManager: any, _transactionData: TransactionData, _data: any): void {
        // No action needed
    },
};