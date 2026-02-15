import { EventTypes } from "../EventNamespace";
import type { State, StateContainer, TransactionData } from "@/Core/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const PlayheadMoveAuto: EventNamespace<typeof EventTypes.PLAYHEAD_MOVE_AUTO> = {
    sharedState: true,

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.PLAYHEAD_MOVE_AUTO,
            emit,
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

    executeSocket(socketManager: any, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};
