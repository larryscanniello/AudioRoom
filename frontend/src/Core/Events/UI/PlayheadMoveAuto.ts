import { EventTypes } from "../EventNamespace";
import type { State, StateContainer, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

// This event happens when playhead is automatically moved during playback/recording
// as opposed to when user manually moves playhead

export const PlayheadMoveAuto: EventNamespace<typeof EventTypes.PLAYHEAD_MOVE_AUTO> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit,serverMandated }) => {
        return {
            type: EventTypes.PLAYHEAD_MOVE_AUTO,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'playheadTimeSeconds', value: param }
                ],
            },
            getEventNamespace: () => { return PlayheadMoveAuto; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): StateContainer {
        return state.getSnapshot();
    },

    executeAudio(_audioEngine: any, _data: any): void {
        //no audio action needed
    },

    executeUI(engine: UIEngine, data: StateContainer ): void {
        engine.draw([DOMCommands.DRAW_PLAYHEAD], data);
    },

    executeSocket(_socketManager: any, _transactionData: TransactionData, _data: any): void {
        // No socket action needed
    },
};
