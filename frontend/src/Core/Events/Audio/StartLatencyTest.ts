import { EventTypes } from "../EventNamespace";
import type { State } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";

import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { StopAudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";
import type { WebRTCManager } from "@/Core/WebRTC/WebRTCManager";


export const StartLatencyTest: EventNamespace<typeof EventTypes.START_LATENCY_TEST> = {
    sharedState: false,

    getDispatchEvent: ({ emit,serverMandated }) => {
         return {
            type: EventTypes.START_LATENCY_TEST,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [
                    { key: "isPlaying", comparitor: "===", target: false },
                    { key: "isRecording", comparitor: "===", target: false },    
                ],
                mutations: []
            },
            getEventNamespace: () => { return StartLatencyTest; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): null {
        return null;
    },

    executeAudio(engine: AudioEngine, _data: StopAudioProcessorData): void {
        console.log("Executing StartLatencyTest event in audio engine");
        engine.startLatencyTest();
    },

    executeUI(_engine: UIEngine): void {
    },

    executeRTC(_webRTCManager: WebRTCManager): void {

    },

    executeSocket(_socketManager: SocketManager, _transactionData: TransactionData, _data: any): void {

    },
};