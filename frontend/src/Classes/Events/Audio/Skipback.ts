import { EventTypes } from "../AppEvent";
import { State } from "@/Classes/State";

import type { AudioEvent } from "../AppEvent";
import type { AudioEngine } from "@/Classes/Audio/AudioEngine";

export class Skipback implements AudioEvent<void> {
    readonly type = EventTypes.SKIPBACK;
    data!: void;

    canExecute(state: State): boolean {
        if(state.query('isRecording')||state.query('isPlaying')) return false;
        return true;
    }

    mutateState(state: State): void {
        state.update('playheadLocation', 0);
        state.update('mouseDragStart', {t:0, trounded:0});
        state.update('mouseDragEnd', null);
    }

    getPayload(_state: State) {
        return { type: this.type }
    }

    execute(_audioEngine: AudioEngine): void {
        
    }
}