import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

export const ToggleStagingMute: EventNamespace<typeof EventTypes.TOGGLE_STAGING_MUTE> = {
    sharedState: true,

    getDispatchEvent: ({ emit, param, serverMandated }) => {
        return {
            type: EventTypes.TOGGLE_STAGING_MUTE,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'stagingMuted', value: param },
                ]
            },
            getEventNamespace: () => { return ToggleStagingMute; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return state.getSharedStateSnapshot();
    },

    executeAudio(engine: AudioEngine, data: any): void {
        engine.setStagingMuted(data.stagingMuted);
    },

    executeUI(_engine: UIEngine, _data: any): void {},

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data, type: EventTypes.TOGGLE_STAGING_MUTE });
    },
};