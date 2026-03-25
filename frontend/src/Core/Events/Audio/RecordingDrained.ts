import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import type { EventNamespace } from "../EventNamespace";
import type { SocketManager } from "@/Core/Sockets/SocketManager";

/*
    Dispatched after the OPFS worker finishes draining the 0.5s headroom ring buffer.
    Clears isDrainingRecording, lifting the guard that prevents re-recording during the drain.
    Emitted to the server so the server state reflects isDrainingRecording: false,
    allowing subsequent START_RECORDING transactions to pass server validation.
*/

export const RecordingDrained: EventNamespace<typeof EventTypes.RECORDING_DRAINED> = {
    sharedState: true,

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

    getLocalPayload(state: State): any {
        return { sharedSnapshot: state.getSharedStateSnapshot() };
    },

    executeAudio(): void {},

    executeUI(): void {},

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {
            transactionData,
            sharedSnapshot: data.sharedSnapshot,
            type: EventTypes.RECORDING_DRAINED,
        });
    },
};