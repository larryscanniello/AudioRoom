import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State";
import { CONSTANTS } from "@/Constants/constants";

export const Record: EventNamespace<typeof EventTypes.START_RECORDING> = {
    sharedState: true,

    getDispatchEvent: ({ emit }) => { return {
            type: EventTypes.START_RECORDING,
            emit,
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
            getEventNamespace: () => { return Record; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
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

    executeSocket(socketManager: SocketManager, transactionData: TransactionData): void {
        executeSocketUtil(socketManager, transactionData);
    },
};