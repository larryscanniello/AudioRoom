import { EventTypes, type EventNamespace } from "../EventNamespace";
import { State, type StateContainer, type TransactionData } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";

export const StateSync: EventNamespace<typeof EventTypes.STATE_SYNC> = {
    sharedState: false,

    getDispatchEvent: ({ param }) => {
        return {
            type: EventTypes.STATE_SYNC,
            param,
            emit: false,
            serverMandated: false, //it is server mandated, but we need a state transaction. 
                                    // note: the name of serverMandated should really be skipTransaction
            transactionData: {
                transactionQueries: [],
                mutations: Object.keys(param).map(key => ({ key: key as keyof StateContainer, value: param[key as keyof StateContainer] }))
            },
            getEventNamespace: () => StateSync,
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): null {
        return null;
    },

    executeAudio(_audioEngine: AudioEngine,_data:AudioProcessorData): void {
        // No action needed
    },

    executeUI(_engine: UIEngine,_data:AudioProcessorData): void {
        // No action needed
    },

    executeSocket(_socketManager: SocketManager, _data: any): void {
       // No action needed - this event is only emitted from the socket, not sent to it
    },
};