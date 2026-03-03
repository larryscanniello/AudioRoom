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


export const SetLatency: EventNamespace<typeof EventTypes.SET_LATENCY> = {
    sharedState: false,

    getDispatchEvent: ({ emit,param,serverMandated }) => {
         return {
            type: EventTypes.SET_LATENCY,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: "latency", value: param }
                ]
            },
            getEventNamespace: () => { return SetLatency; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): null {
        return null;
    },

    executeAudio(_engine: AudioEngine, _data: StopAudioProcessorData): void {
        
    },

    executeUI(_engine: UIEngine): void {
    },

    executeRTC(_webRTCManager: WebRTCManager): void {

    },

    executeSocket(_socketManager: SocketManager, _transactionData: TransactionData, _data: any): void {

    },
};