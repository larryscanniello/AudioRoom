import { EventTypes } from "../AppEvent";
import { State } from "@/Classes/State";

import type { AudioEvent } from "../AppEvent";
import type { AudioEngine } from "@/Classes/Audio/AudioEngine";
import { type StopAudioProcessorData } from "@/Types/AudioState";

export class Stop implements AudioEvent<StopAudioProcessorData> {
    readonly type = EventTypes.STOP;
    data!: StopAudioProcessorData;

    canExecute(_state: State): boolean {
        return true;
    }

    mutateState(state: State): void {
        state.update('isPlaying', false);
        if(state.query('isRecording')){
            state.update('take', state.query('take') + 1)
        }
        state.update('isRecording', false);
    }

    getPayload(_state: State) {
        this.data = {type:"stop"}
        return this.data;
    }

    execute(engine:AudioEngine): void {
        if(!this.data){
            console.error("No data available for Stop event");
            return;
        }
        engine.stop(this.data);
    }
}