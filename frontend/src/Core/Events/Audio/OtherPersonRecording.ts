import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State/State";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import { stateTransactionUtil } from "../genericEventFunctions";

import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";

import { CONSTANTS } from "@/Constants/constants";

type LocalPayload = {sharedSnapshot: Partial<StateContainer>, audioProcessorData: AudioProcessorData}

export const OtherPersonRecording: EventNamespace<typeof EventTypes.OTHER_PERSON_RECORDING> = {
    sharedState: true,

    getDispatchEvent: ({ emit,param,serverMandated }) => { return {
            type: EventTypes.OTHER_PERSON_RECORDING,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'isRecording', value: true },
                    { key: 'take', value: param },
                ]
            },
            getEventNamespace: () => { return OtherPersonRecording; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): LocalPayload {
        //grab all of this data for playhead in execute ui. although playhead doesnt really need all of this data.
        const mouseDragEnd = state.query('mouseDragEnd');
        const audioProcessorData = { type: EventTypes.OTHER_PERSON_RECORDING,
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
                pos: state.query('playheadTimeSeconds'),
                staging: state.query('timeline').staging,
                mix: state.query('timeline').mix,
            }
        };
        const sharedSnapshot = state.getSharedStateSnapshot();
        return {sharedSnapshot,audioProcessorData};
    },

    executeAudio(audioEngine: AudioEngine, data: LocalPayload): void {
        audioEngine.otherPersonRecording(data.audioProcessorData);
    },

    executeUI(engine: UIEngine, data: LocalPayload): void {
        engine.startPlayhead(data.audioProcessorData.timeline);
    },

    executeSocket(_socketManager: SocketManager, _transactionData: TransactionData, _data: LocalPayload): void {
        //
    },
};