import { EventTypes } from "../EventNamespace";
import type { State } from "@/Classes/State";
import { CONSTANTS } from "@/Constants/constants";
import type { AudioEngine } from "@/Classes/Audio/AudioEngine";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Classes/UI/UIEngine";
import type { SocketManager } from "@/Classes/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";

export const Play:EventNamespace = {
    sharedState: true,

    transactionData: {
        transactionQueries: [
            {key: 'isPlaying', comparitor: '===', target: false},
            {key: 'isRecording', comparitor: '===', target: false},
            {key: 'playheadLocation', comparitor: '<', target: CONSTANTS.TIMELINE_LENGTH_IN_SECONDS},
        ],
        mutations: [
            {key: 'isPlaying', value: true},
        ]
    },

    getDispatchEvent: ({data,emit}) => { 
        return { 
            type: EventTypes.START_PLAYBACK,
            data,
            emit,
            getEventNamespace:()=>{return Play}
        }},
    
    stateTransaction(state: State): boolean {
        return stateTransactionUtil(state, this.transactionData, this.sharedState);
    },

    getLocalPayload(state: State): AudioProcessorData {
        const mouseDragEnd = state.query('mouseDragEnd');
        const data = { type: EventTypes.START_PLAYBACK,
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
                start: state.query('playheadLocation'),
                end: mouseDragEnd ? mouseDragEnd.t : CONSTANTS.TIMELINE_LENGTH_IN_SECONDS,
                pos: state.query('playheadLocation')
            }
        }
        return data;
    },

    executeAudio(audioEngine: AudioEngine,data:AudioProcessorData): void {
        audioEngine.play(data);
    },

    executeUI(engine: UIEngine,data:AudioProcessorData): void {
        engine.startPlayhead(data.timeline);
    },

    executeSocket(socketManager: SocketManager, _data:any): void {
        executeSocketUtil(socketManager, this.transactionData);
    },
};

