import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

/*
    A question you might have is: Why not put all of this in the stop event?
    The stop event doesn't know if recording has just stopped or if regular playback has stopped.
    The audio worklet, however, does know know when recording is stopped. When a recording is stopped,
    the worklet triggers a post message to the audio engine which triggers this event.
    This event adds the new region to the timeline, and triggers a UI update which makes a call
    to render the mipmaps in OPFS.
*/

export const RecordingFinished: EventNamespace<typeof EventTypes.RECORDING_FINISHED> = {
    sharedState: false,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.RECORDING_FINISHED,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [{ key: 'timeline', value: param }],
            },
            getEventNamespace: () => { return RecordingFinished; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return state.getSharedStateSnapshot();
    },

    executeAudio(_audioEngine: WorkletAudioEngine, _data: any): void {
        //No audio action
    },

    executeUI(engine: UIEngine, _data: any): void {
        engine.renderNewRegion();
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data, type: EventTypes.RECORDING_FINISHED});
    },
};