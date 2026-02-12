import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import { CONSTANTS } from "@/Constants/constants";

export const Record: EventNamespace<typeof EventTypes.START_RECORDING>   = {
    sharedState: true,

    transactionData: {
        transactionQueries: [
            { key: 'isPlaying', comparitor: '===', target: false },
            { key: 'isRecording', comparitor: '===', target: false },
        ],
        mutations: [
            { key: 'isRecording', value: true },
            { key: 'take', value: "++" },
        ]
    },

    getDispatchEvent: ({ emit }) => { return {
            type: EventTypes.START_RECORDING,
            param: null,
            emit,
            getEventNamespace: () => { return Record; }
        }},

    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
    },

    getLocalPayload(state: State): AudioProcessorData {
        const mouseDragEnd = state.query('mouseDragEnd');
        const data = { type: EventTypes.START_RECORDING,
            state: {
                isPlaying: state.query('isPlaying'),
                isRecording: state.query('isRecording'),
                isStreaming: state.query('isStreaming'),
                looping: state.query('isLooping'),
                count: {
                    bounce: state.query('bounce'),
                    take: state.query('take'),
                },
                packetCount: 0,
            },
            timeline: {
                start: state.query('playheadTimeSeconds'),
                end: mouseDragEnd ? mouseDragEnd.t : CONSTANTS.TIMELINE_LENGTH_IN_SECONDS,
                pos: state.query('playheadTimeSeconds')
            }
        };
        return data;
    },

    executeAudio(audioEngine: AudioEngine, data: AudioProcessorData): void {
        audioEngine.record(data);
    },

    executeUI(engine: UIEngine, data: AudioProcessorData): void {
        engine.startPlayhead(data.timeline);
    },

    executeSocket(socketManager: SocketManager, _data: any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};