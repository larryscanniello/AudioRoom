import { EventTypes } from "../EventNamespace";
import type { State, TransactionData } from "@/Core/State/State";
import type { UIEngine } from "@/Core/UI/UIEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";
import { DOMCommands } from "@/Constants/DOMElements";

import type { EventNamespace } from "../EventNamespace";
import type { WorkletAudioEngine } from "@/Core/Audio/WorkletAudioEngine";

export const ReStage: EventNamespace<typeof EventTypes.RESTAGE> = {
    sharedState: true,

    getDispatchEvent: ({ param, emit, serverMandated }) => {
        return {
            type: EventTypes.RESTAGE,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'timeline', value: param.timeline },
                    { key: 'mixerState', value: param.mixerState },
                ],
            },
            getEventNamespace: () => { return ReStage; }
        };
    },

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): any {
        return { snapshot: state.getSnapshot(), sharedSnapshot: state.getSharedStateSnapshot() };
    },

    executeAudio(engine: WorkletAudioEngine, data: any): void {
        engine.reStage({
            type: "re_stage_bounce",
            newStagingTimeline: data.snapshot.timeline.staging,
            newMixTimelines: data.snapshot.timeline.mix.map((l: any) => l.regions),
        });
        const channels: any[] = data.snapshot.mixerState.channels;
        const bounceLayers: any[] = data.snapshot.timeline.mix;

        // Wire the restaged effects onto staging
        const stagingChannel = channels.find((c: any) => c.id === 'staging');
        engine.setStagingEffectChain(stagingChannel?.effects ?? []);

        // Re-apply all remaining bounce track chains (indices may have shifted)
        for (let i = 0; i < bounceLayers.length; i++) {
            const channel = channels.find((c: any) => c.id === bounceLayers[i].id);
            engine.setEffectChain(i, channel?.effects ?? []);
        }
        // Clear the vacated slot left by the removed track
        engine.setEffectChain(bounceLayers.length, []);

        engine.syncMixerVolumes(data.snapshot.mixerState, bounceLayers);
    },

    executeUI(engine: UIEngine, data: any): void {
        engine.draw([
            DOMCommands.DRAW_TRACK_ONE_WAVEFORMS,
            DOMCommands.RENDER_TRACK_ONE_REGIONS,
            DOMCommands.DRAW_TRACK_TWO_WAVEFORMS,
            DOMCommands.RENDER_TRACK_TWO_REGIONS,
        ], data.snapshot);
    },

    executeSocket(socketManager: any, transactionData: TransactionData, data: any): void {
        executeSocketUtil(socketManager, { transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.RESTAGE });
    },
};
