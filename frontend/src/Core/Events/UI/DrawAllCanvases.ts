import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const DrawAllCanvases: EventNamespace<typeof EventTypes.DRAW_ALL_CANVASES> = {
    sharedState: false,

    transactionData: {
        transactionQueries: [],
        mutations: [],
    },

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.DRAW_ALL_CANVASES,
            param,
            emit,
            getEventNamespace: () => { return DrawAllCanvases; }
        };
    },

    stateTransaction(_state: State, _stateUpdate: any): boolean {
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

    executeSocket(socketManager: any, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};