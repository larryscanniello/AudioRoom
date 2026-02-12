import { EventTypes } from "../EventNamespace";
import type { State, StateContainer, TransactionData } from "@/Core/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";

export const MovePlayhead: EventNamespace<typeof EventTypes.MOVE_PLAYHEAD> = {
    sharedState: true,

    transactionData: {
        transactionQueries: [],
        mutations: [],
    },

    getDispatchEvent: ({ param, emit }) => {
        return {
            type: EventTypes.MOVE_PLAYHEAD,
            param,
            emit,
            getEventNamespace: () => { return MovePlayhead; }
        };
    },

    stateTransaction(state: State, stateUpdate: number): boolean {
        const transactionData: TransactionData = {
            transactionQueries: [
                { key: 'isPlaying', comparitor: '===', target: false },
                { key: 'isRecording', comparitor: '===', target: false },
            ],
            mutations: [
                { key: 'playheadTimeSeconds', value: stateUpdate }
            ],
        };
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

    executeSocket(socketManager: any, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};
