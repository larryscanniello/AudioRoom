import { EventTypes, type EventNamespace } from "../EventNamespace"
import type { State, StateContainer, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";



export const MipMapsDone: EventNamespace<typeof EventTypes.MIPMAPS_DONE> = {
    sharedState: true,

    getDispatchEvent: ({ emit }) => {
        return {
            type: EventTypes.MIPMAPS_DONE,
            emit,
            transactionData: {
                transactionQueries: [],
                mutations: [],
            },
            getEventNamespace: () => { return MipMapsDone; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): StateContainer {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {

    },

    executeUI(engine: UIEngine, data: StateContainer ): void {
        engine.draw([
            DOMCommands.RENDER_TRACK_ONE_REGIONS,
            DOMCommands.RENDER_TRACK_TWO_REGIONS,
            DOMCommands.DRAW_TRACK_ONE_WAVEFORMS,
            DOMCommands.DRAW_TRACK_TWO_WAVEFORMS,
        ], data);
    },

    executeSocket(_socketManager: any, _transactionData: TransactionData): void {
        //No action needed
    },
};