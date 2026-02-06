
import type { State } from "@/Classes/State";
import { EventTypes } from "../AppEvent"
import type { StateChange } from "../AppEvent";
import type { StateContainer } from "@/Classes/State";

export class BPMchange implements StateChange<'bpm'> {
    readonly type = EventTypes.CHANGE_BPM;
    toChangeTo: number = 0;

    constructor(toChangeTo: number) {
        this.toChangeTo = toChangeTo;
    }

    canExecute(state: State): boolean {
        if(state.query('isPlaying')||state.query('isRecording')){
            return false;
        }
        if(this.toChangeTo<30 || this.toChangeTo>300){
            return false;
        }
        return true;
    }

    mutateState(state: State): void {
        state.update('bpm', this.toChangeTo);
    }

    getPayload(state: State): StateContainer {
        return state.getSnapshot();
    }


}