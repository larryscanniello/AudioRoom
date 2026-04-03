import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";
import type { MixerState } from "@/Types/AudioState";

type Payload = { mixerState: MixerState; sharedSnapshot: any };

export const ChangeChannelVolume: EventNamespace<typeof EventTypes.CHANGE_CHANNEL_VOLUME> = {
    sharedState: true,

    getDispatchEvent: ({ emit, param, serverMandated }) => {
        return {
            type: EventTypes.CHANGE_CHANNEL_VOLUME,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'mixerState', value: param },
                ]
            },
            getEventNamespace: () => { return ChangeChannelVolume; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        return {
            mixerState: state.query('mixerState'),
            sharedSnapshot: state.getSharedStateSnapshot(),
        };
    },

    executeAudio(engine: AudioEngine, data: Payload): void {
        engine.syncMixerVolumes(data.mixerState);
    },

    executeUI(_engine: UIEngine, _data: any): void {},

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: Payload): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.CHANGE_CHANNEL_VOLUME });
    },
};