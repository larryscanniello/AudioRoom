import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State/State";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";
import { CONSTANTS } from "@/Constants/constants";
import type { WebRTCManager } from "@/Core/WebRTC/WebRTCManager";

type LocalPayload = {sharedSnapshot: Partial<StateContainer>, audioProcessorData: AudioProcessorData}

export const Record: EventNamespace<typeof EventTypes.START_RECORDING> = {
    sharedState: true,

    getDispatchEvent: ({ emit,param,serverMandated }) => { return {
            type: EventTypes.START_RECORDING,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    { key: 'isPlaying', comparitor: '===', target: false },
                    { key: 'isRecording', comparitor: '===', target: false },
                ],
                mutations: [
                    { key: 'isRecording', value: true },
                    { key: 'take', value: param },
                ]
            },
            getEventNamespace: () => { return Record; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): LocalPayload {
        const mouseDragEnd = state.query('mouseDragEnd');
        const audioProcessorData = { type: EventTypes.START_RECORDING,
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
                bpm: state.query('bpm'),
            },
            timeline: {
                start: state.query('playheadTimeSeconds'),
                end: mouseDragEnd ? mouseDragEnd.t : CONSTANTS.TIMELINE_LENGTH_IN_SECONDS,
                pos: state.query('playheadTimeSeconds'),
                staging: state.query('timeline').staging,
                mix: state.query('timeline').mix,
            }
        };
        const sharedSnapshot = state.getSharedStateSnapshot();
        return {sharedSnapshot,audioProcessorData};
    },

    executeAudio(audioEngine: AudioEngine, data: LocalPayload): void {
        audioEngine.record(data.audioProcessorData);
    },

    executeUI(engine: UIEngine, data: LocalPayload): void {
        engine.startPlayhead(data.audioProcessorData.timeline);
    },

    executeRTC(webRTCManager: WebRTCManager, data: LocalPayload): void {
        webRTCManager.record(data.audioProcessorData);
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: LocalPayload): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.START_RECORDING});
    },
};