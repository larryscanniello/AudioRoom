import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

type Payload = { stagingMasterVolume: number; sharedSnapshot: any };

export const ChangeStagingVolume: EventNamespace<typeof EventTypes.CHANGE_STAGING_VOLUME> = {
    sharedState: true,

    getDispatchEvent: ({ emit, param, serverMandated }) => {
        return {
            type: EventTypes.CHANGE_STAGING_VOLUME,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'stagingMasterVolume', value: param },
                ]
            },
            getEventNamespace: () => { return ChangeStagingVolume; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        return {
            stagingMasterVolume: state.query('stagingMasterVolume'),
            sharedSnapshot: state.getSharedStateSnapshot(),
        };
    },

    executeAudio(engine: AudioEngine, data: Payload): void {
        engine.setStagingVolume(data.stagingMasterVolume);
    },

    executeUI(_engine: UIEngine, _data: any): void {},

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: Payload): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.CHANGE_STAGING_VOLUME });
    },
};