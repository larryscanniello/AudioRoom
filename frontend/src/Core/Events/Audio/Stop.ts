import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { StopAudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";

export const Stop: EventNamespace<typeof EventTypes.STOP> = {
    sharedState: true,

    transactionData: {
        transactionQueries: [],
        mutations: [
            { key: 'isPlaying', value: false },
            { key: 'isRecording', value: false },
        ]
    },

    getDispatchEvent: ({ emit }) => {
         return {
            type: EventTypes.STOP,
            param: null,
            emit,
            getEventNamespace: () => { return Stop; }
        }},

    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): StopAudioProcessorData {
        return { type: "stop" };
    },

    executeAudio(engine: AudioEngine, data: StopAudioProcessorData): void {
        engine.stop(data);
    },

    executeUI(engine: UIEngine): void {
        engine.stopPlayhead();
    },

    executeSocket(socketManager: SocketManager, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};