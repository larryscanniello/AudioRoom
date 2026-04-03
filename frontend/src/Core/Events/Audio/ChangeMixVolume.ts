import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

type Payload = { mixMasterVolume: number; sharedSnapshot: any };

export const ChangeMixVolume: EventNamespace<typeof EventTypes.CHANGE_MIX_VOLUME> = {
    sharedState: true,

    getDispatchEvent: ({ emit, param, serverMandated }) => {
        return {
            type: EventTypes.CHANGE_MIX_VOLUME,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'mixMasterVolume', value: param },
                ]
            },
            getEventNamespace: () => { return ChangeMixVolume; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        return {
            mixMasterVolume: state.query('mixMasterVolume'),
            sharedSnapshot: state.getSharedStateSnapshot(),
        };
    },

    executeAudio(engine: AudioEngine, data: Payload): void {
        engine.setMixVolume(data.mixMasterVolume);
    },

    executeUI(_engine: UIEngine, _data: any): void {},

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: Payload): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.CHANGE_MIX_VOLUME });
    },
};