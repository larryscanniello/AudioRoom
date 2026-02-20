import { EventTypes } from "../EventNamespace";
import type { State, StateContainer } from "@/Core/State/State";
import { executeSocketUtil, stateTransactionUtil } from "../genericEventFunctions";

import type { AudioEngine } from "@/Core/Audio/AudioEngine";
import type { StopAudioProcessorData } from "@/Types/AudioState";
import type { UIEngine } from "@/Core/UI/UIEngine";
import type { SocketManager } from "@/Core/Sockets/SocketManager";
import type { EventNamespace } from "../EventNamespace";
import type { TransactionData } from "@/Core/State/State";

type Payload = {type: typeof EventTypes.STOP, sharedSnapshot: Partial<StateContainer>}

export const Stop: EventNamespace<typeof EventTypes.STOP> = {
    sharedState: true,

    getDispatchEvent: ({ emit,serverMandated }) => {
         return {
            type: EventTypes.STOP,
            emit,
            serverMandated,
            transactionData: {
                transactionQueries: [],
                mutations: [
                    { key: 'isPlaying', value: false },
                    { key: 'isRecording', value: false },
                ]
            },
            getEventNamespace: () => { return Stop; }
        }},

    stateTransaction(state: State, transactionData: TransactionData): boolean {
        return stateTransactionUtil(state, transactionData, this.sharedState);
    },

    getLocalPayload(state: State): Payload {
        return { type: EventTypes.STOP, sharedSnapshot: state.getSharedStateSnapshot() };
    },

    executeAudio(engine: AudioEngine, data: StopAudioProcessorData): void {
        engine.stop(data);
    },

    executeUI(engine: UIEngine): void {
        engine.stopPlayhead();
    },

    executeSocket(socketManager: SocketManager, transactionData: TransactionData, data: Payload): void {
        executeSocketUtil(socketManager, {transactionData, sharedSnapshot: data.sharedSnapshot, type: EventTypes.STOP});
    },
};