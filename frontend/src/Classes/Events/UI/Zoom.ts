import { EventTypes } from "../EventNamespace";
import type { State } from "@/Classes/State";
import type { UIEngine } from "@/Classes/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const Zoom: EventNamespace = {
    sharedState: true,

    transactionData: {
        transactionQueries: [],
        mutations: {key: 'viewport', value: }
    },

    getDispatchEvent: ({ data, emit }) => {
        return {
            type: EventTypes.ZOOM,
            data,
            emit,
            getEventNamespace: () => { return Zoom; }
        };
    },

    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No audio action needed for zoom
    },

    executeUI(engine: UIEngine, data: any): void {
        engine.draw(Object.values(DOMCommands),data);
    },

    executeSocket(socketManager: any, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};

