import { EventTypes, type EventNamespace } from "../EventNamespace"
import type { State, StateContainer, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { stateTransactionUtil } from "../genericEventFunctions";



export const RemoteStreamAttached: EventNamespace<typeof EventTypes.REMOTE_STREAM_ATTACHED> = {
    sharedState: true,

    getDispatchEvent: ({ emit,param }) => {
        return {
            type: EventTypes.REMOTE_STREAM_ATTACHED,
            emit,
            param,
            transactionData: {
                transactionQueries: [],
                mutations: [{key: 'remoteStreamAttached', value: param}],
            },
            getEventNamespace: () => { return RemoteStreamAttached; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): null {
        return null;
    },

    executeAudio(_audioEngine: any, _data: any): void {
        // No action needed
    }, 

    executeUI(_engine: UIEngine, _data: StateContainer ): void {
        // No action needed
    },

    executeSocket(_socketManager: any, _transactionData: TransactionData): void {
        // No action needed
    },
};