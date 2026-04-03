import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

export const ToggleMixMute: EventNamespace<typeof EventTypes.TOGGLE_MIX_MUTE> = {
    sharedState: true,

    getDispatchEvent: ({ emit, param, serverMandated }) => {
        return {
            type: EventTypes.TOGGLE_MIX_MUTE,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'mixMuted', value: param },
                ]
            },
            getEventNamespace: () => { return ToggleMixMute; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return state.getSharedStateSnapshot();
    },

    executeAudio(engine: AudioEngine, data: any): void {
        engine.setMixMuted(data.mixMuted);
    },

    executeUI(_engine: UIEngine, _data: any): void {},

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data, type: EventTypes.TOGGLE_MIX_MUTE });
    },
};