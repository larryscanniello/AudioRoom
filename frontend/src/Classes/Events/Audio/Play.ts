import { EventTypes } from "../AppEvent";
import { State } from "@/Classes/State";
import { AudioEngine } from "@/Classes/Audio/AudioEngine";

import type { AudioEvent } from "../AppEvent";
import type { AudioProcessorData } from "@/Types/AudioState";
import { TIMELINE_LENGTH } from "@/Constants/constants";

export class Play implements AudioEvent<AudioProcessorData> {
    readonly type = EventTypes.START_PLAYBACK;
    data!: AudioProcessorData;

    canExecute(state: State): boolean {
        if(state.query('isPlaying')||state.query('isRecording')){
            return false;
        }
        return true;
    }

    mutateState(state: State): void {
        state.update('isPlaying', true);
    }

    getPayload(state: State): AudioProcessorData {
        const mouseDragEnd = state.query('mouseDragEnd');
        this.data = { type: this.type,
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
                end: mouseDragEnd ? mouseDragEnd.t : TIMELINE_LENGTH,
                pos: state.query('playheadLocation')
            }
        }
        return this.data;
    }

    execute(audioEngine: AudioEngine): void {
        if(!this.data){
            console.error("Play event data is not set");
            return;
        };
        audioEngine.play(this.data);
    }
}