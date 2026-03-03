import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State/State";
import { stateTransactionUtil } from "../genericEventFunctions";

import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { StopAudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";
import type { WebRTCManager } from "@/Core/WebRTC/WebRTCManager";
import { Stop } from "./Stop";

type Payload = {type: typeof EventTypes.STOP, sharedSnapshot: Partial<StateContainer>}

export const LatencyTestDone: EventNamespace<typeof EventTypes.LATENCY_TEST_DONE> = {
    sharedState: false,

    getDispatchEvent: ({ emit,param,serverMandated }) => {
         return {
            type: EventTypes.LATENCY_TEST_DONE,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    {key: "delayCompensation", value: param}
                ]
            },
            getEventNamespace: () => { return Stop; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(_state: State): null {
        return null;
    },

    executeAudio(engine: AudioEngine, _data: StopAudioProcessorData): void {
        engine.startLatencyTest();
    },

    executeUI(_engine: UIEngine): void {
    },

    executeRTC(_webRTCManager: WebRTCManager): void {

    },

    executeSocket(_socketManager: SocketManager, _transactionData: TransactionData, _data: Payload): void {

    },
};