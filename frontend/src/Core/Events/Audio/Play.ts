import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State/State";
import { CONSTANTS } from "@/Constants/constants";
import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";

type Payload = {processordata: AudioProcessorData, sharedSnapshot: Partial<StateContainer>}

export const Play:EventNamespace<typeof EventTypes.START_PLAYBACK> = {
    sharedState: true,


    getDispatchEvent: ({emit,serverMandated}) => { 
        return { 
            type: EventTypes.START_PLAYBACK,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    {key: 'isPlaying', comparitor: '===', target: false},
                    {key: 'isRecording', comparitor: '===', target: false},
                    {key: 'playheadTimeSeconds', comparitor: '<', target: CONSTANTS.TIMELINE_LENGTH_IN_SECONDS},
                ],
                mutations: [
                    {key: 'isPlaying', value: true},
                ]
            },
            getEventNamespace:()=>{return Play}
        }},
    
    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        const mouseDragEnd = state.query('mouseDragEnd');
        const processordata = { type: EventTypes.START_PLAYBACK,
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

        }
        const sharedSnapshot = state.getSharedStateSnapshot();
        return { processordata, sharedSnapshot };
    },

    executeAudio(audioEngine: AudioEngine,data:Payload): void {
        audioEngine.play(data.processordata);
    },

    executeUI(engine: UIEngine,data:Payload): void {
        engine.startPlayhead(data.processordata.timeline);
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: Payload): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.START_PLAYBACK});
    },
};

