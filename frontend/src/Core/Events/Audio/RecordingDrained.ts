import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { EventNamespace } from "../EventNamespace";

/*
    Dispatched after the OPFS worker finishes draining the 0.5s headroom ring buffer.
    Clears isDrainingRecording, lifting the guard that prevents re-recording during the drain.
    Local-only — drain is an OPFS operation on the local machine; collaborators don't need it.
*/

export const RecordingDrained: EventNamespace<typeof EventTypes.RECORDING_DRAINED> = {
    sharedState: false,

    getDispatchEvent: ({ emit, serverMandated }) => {
        return {
            type: EventTypes.RECORDING_DRAINED,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'isDrainingRecording', value: false },
                    { key: 'liveRecording', value: { start: 0, end: 0 } },
                ],
            },
            getEventNamespace: () => RecordingDrained,
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): any {
        return {};
    },

    executeAudio(): void {},

    executeUI(): void {},

    executeSocket(): void {},
};