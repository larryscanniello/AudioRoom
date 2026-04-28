import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";
import type { BounceLayer, MixerState } from "@/Types/AudioState";

type Payload = { mixerState: MixerState; bounceLayers: readonly BounceLayer[] };

export const LoadWamPlugin: EventNamespace<typeof EventTypes.LOAD_WAM_PLUGIN> = {
    sharedState: true,

    getDispatchEvent: ({ emit, param, serverMandated }) => ({
        type: EventTypes.LOAD_WAM_PLUGIN,
        emit,
        serverMandated,
        transactionData: {
            transactionQueries: [],
            mutations: [{ key: 'mixerState', value: param }],
        },
        getEventNamespace: () => LoadWamPlugin,
    }),

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        return {
            mixerState: state.query('mixerState'),
            bounceLayers: state.query('timeline').mix,
        };
    },

    executeAudio(engine: AudioEngine, data: Payload): void {
        const { mixerState, bounceLayers } = data;
        for (const channel of mixerState.channels) {
            const effects = channel.effects ?? [];
            effects.forEach((slot, slotIndex) => {
                if (!slot || slot.effectType !== 'wam' || !slot.pluginUrl) return;
                const trackIndex: number | 'staging' =
                    channel.id === 'staging'
                        ? 'staging'
                        : bounceLayers.findIndex((l: any) => l.id === channel.id);
                engine.loadWamPlugin(trackIndex, slotIndex, slot.pluginUrl).then(() => {
                    if (channel.id === 'staging') {
                        engine.setStagingEffectChain(effects);
                    } else if (typeof trackIndex === 'number' && trackIndex >= 0) {
                        engine.setEffectChain(trackIndex, effects);
                    }
                });
            });
        }
    },

    executeUI(_engine: UIEngine, _data: any): void {},

    executeSocket(_socketManager: SocketManager, _transactionData: TransactionData, _data: any): void {},
};