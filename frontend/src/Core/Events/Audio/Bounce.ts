

import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { TransactionData } from "@/Core/State/State";

export const Bounce: EventNamespace<typeof EventTypes.BOUNCE> = {
    sharedState: true,

    getDispatchEvent: ({ emit,param,serverMandated }) => { 
        return {
            type: EventTypes.BOUNCE,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    { key: 'isRecording', comparitor: '===', target: false },
                    { key: 'isPlaying', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'take', value: 0 },
                    { key: 'bounce', value: param.bounce },
                    { key: 'timeline', value: param.timeline },
                    { key: 'mixerState', value: param.mixerState },
                ]
            },
            getEventNamespace: () => { return Bounce; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return {snapshot: state.getSnapshot(), sharedSnapshot: state.getSharedStateSnapshot()};
    },

    executeAudio(engine: AudioEngine,data:any): void {
        engine.bounce({
            type: "bounce_to_mix",
            mixTimelines: data.snapshot.timeline.mix.map((l: any) => l.regions),
            bounce: data.snapshot.bounce,
        });
        const bounceLayers: any[] = data.snapshot.timeline.mix;
        const channels: any[] = data.snapshot.mixerState.channels;
        for (const channel of channels) {
            if (channel.type !== 'track' || channel.id === 'staging') continue;
            const trackIndex = bounceLayers.findIndex((l: any) => l.id === channel.id);
            if (trackIndex >= 0 && channel.effects?.length > 0) {
                engine.setEffectChain(trackIndex, channel.effects);
            }
        }
    },

    executeUI(engine: UIEngine,data:any): void {
        engine.draw([
            DOMCommands.DRAW_TRACK_ONE_WAVEFORMS,
            DOMCommands.DRAW_TRACK_TWO_WAVEFORMS,
            DOMCommands.RENDER_TRACK_ONE_REGIONS,
            DOMCommands.RENDER_TRACK_TWO_REGIONS,
        ],data.snapshot)  
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.BOUNCE});
    },
};
