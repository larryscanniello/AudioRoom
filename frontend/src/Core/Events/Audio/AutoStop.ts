import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { StopAudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";
import type { WebRTCManager } from "@/Core/WebRTC/WebRTCManager";

/*
    This event is for when audio/playback auto stops at playback region end in the worklet
    The only difference between this and regular stop is that there is no audio engine action
*/

type Payload = {type: typeof EventTypes.AUTO_STOP, sharedSnapshot: Partial<StateContainer>}

export const AutoStop: EventNamespace<typeof EventTypes.AUTO_STOP> = {
    sharedState: true,

    getDispatchEvent: ({ emit,param,serverMandated }) => {
         return {
            type: EventTypes.AUTO_STOP,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'isPlaying', value: false },
                    { key: 'isRecording', value: false },
                    //Since playhead isnt updated over sockets during playback/recording, we need to resync it
                    { key: 'playheadTimeSeconds', value: param },
                    { key: 'liveRecording', value: {start: 0, end: 0} },
                ]
            },
            getEventNamespace: () => { return AutoStop; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        return { type: EventTypes.AUTO_STOP, sharedSnapshot: state.getSharedStateSnapshot() };
    },

    executeAudio(_engine: AudioEngine, _data: StopAudioProcessorData): void {
        // No audio engine action for auto stop
    },

    executeUI(engine: UIEngine): void {
        engine.stopPlayhead();
    },

    executeRTC(webRTCManager: WebRTCManager): void {
        webRTCManager.stop();
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: Payload): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.AUTO_STOP});
    },
};