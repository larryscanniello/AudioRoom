import { EventTypes } from "../AppEvent";
import { State } from "@/Classes/State";

import type { AudioEvent } from "../AppEvent";
import type { AudioEngine } from "@/Classes/Audio/AudioEngine";
import type { AudioProcessorData } from "@/Types/AudioState";

export class Record implements AudioEvent<AudioProcessorData> {
    readonly type = EventTypes.START_RECORDING;
    data!: AudioProcessorData;
    
    canExecute(state: State): boolean {
        if(state.query('isPlaying')||state.query('isRecording')){
            return false;
        }
        return true;
    }

    mutateState(state: State): void {
        state.update('isRecording', true);
    }

    getPayload(state: State) {
        const mouseDragEnd = state.query('mouseDragEnd');
        return { type: this.type,
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
                end: mouseDragEnd ? mouseDragEnd.t : null,
                pos: state.query('playheadLocation')
            }
        }
    }

    execute(audioEngine: AudioEngine): void {
        if(!this.data){
            console.error("Record event data is not set");
            return;
        }
        audioEngine.record(this.data);
    }
}