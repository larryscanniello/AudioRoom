

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

    getDispatchEvent: ({ emit,param }) => { return {
            type: EventTypes.BOUNCE,
            emit,
            transactionData: {
                transactionQueries: [
                    { key: 'isRecording', comparitor: '===', target: false },
                    { key: 'isPlaying', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'take', value: 0 },
                    { key: 'bounce', value: "++" },
                    { key: 'timeline', value: param },
                ]
            },
            getEventNamespace: () => { return Bounce; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State) {
        return state.getSnapshot();
    },

    executeAudio(engine: AudioEngine,data:any): void {
        engine.bounce({
            type: "bounce_to_mix",
            mixTimelines: data.timeline.mix,
            bounce: data.bounce,
        });
    },

    executeUI(engine: UIEngine,data:any): void {
        engine.draw([
            DOMCommands.DRAW_TRACK_ONE_WAVEFORMS,
            DOMCommands.DRAW_TRACK_TWO_WAVEFORMS,
            DOMCommands.RENDER_TRACK_ONE_REGIONS,
            DOMCommands.RENDER_TRACK_TWO_REGIONS,
        ],data)  
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};
