
import { EventTypes } from "../AppEvent";
import { MIN_SAMPLES_PER_PX,TIMELINE_LENGTH_IN_SECONDS,SAMPLE_RATE } from "@/Constants/constants";
import { DOMCommands } from "@/Constants/DOMElements";

import type { State } from "@/Classes/State";
import type { CanvasEvent } from "../AppEvent";
import type { UIEngine } from "@/Classes/UI/UIEngine";
import type { StateContainer } from "@/Classes/State";

export class setZoom implements CanvasEvent<number> {
    readonly type = EventTypes.SET_ZOOM;
    data: number;
    widthRef: React.RefObject<HTMLElement>;
    playheadRef: React.RefObject<HTMLElement>;
    newState!: StateContainer;

    constructor(newSliderVal: number, widthRef: React.RefObject<HTMLElement>,playheadRef: React.RefObject<HTMLElement>) {
        this.data = newSliderVal;
        this.widthRef = widthRef;
        this.playheadRef = playheadRef;
    }
    
    canExecute(_state: State): boolean {
        if(this.data<MIN_SAMPLES_PER_PX) return false;
        if(!(this.widthRef.current instanceof HTMLCanvasElement)){
            console.error("Reference is not a CanvasHTMLElement");
            return false;
        }
        const WIDTH = this.widthRef.current.clientWidth;
        const maxSamplesPerPx = TIMELINE_LENGTH_IN_SECONDS * SAMPLE_RATE / WIDTH;
        if(this.data > maxSamplesPerPx) return false;
        return true;
    }

    mutateState(state: State): void {
        /*
            Slider vals are integers between 0 and 1000. 
            Samples per px are values between 10 and a max that depends on window size
            We map between values exponentially. If n is a slider val,
            then the samplesPerPx is 10 * b ** n
        */
        const WIDTH = this.widthRef.current.clientWidth;
        const maxSamplesPerPx = TIMELINE_LENGTH_IN_SECONDS * SAMPLE_RATE / WIDTH;
        const b = (maxSamplesPerPx / 10) ** (1 / 1000);
        const newZoom = 10 * b ** this.data;

        const prevViewPort = state.query('viewport');
        const start = prevViewPort.startTime;
        const end = start + WIDTH * prevViewPort.samplesPerPx;
        const center = (start + end) / 2;

        let newStart, newEnd;
        if (center + (WIDTH * newZoom) / 2 < TIMELINE_LENGTH_IN_SECONDS && center - (WIDTH * newZoom) / 2 >= 0) {
            newStart = center - (WIDTH * newZoom) / 2;
            newEnd = center + (WIDTH * newZoom) / 2;
        } else if (center + (WIDTH * newZoom) / 2 >= TIMELINE_LENGTH_IN_SECONDS) {
            newEnd = TIMELINE_LENGTH_IN_SECONDS;
            newStart = TIMELINE_LENGTH_IN_SECONDS - WIDTH * newZoom;
        } else {
            newStart = 0;
            newEnd = WIDTH * newZoom;
        }

        const playheadLocation = state.query('playheadLocation');
        if (playheadLocation >= start && playheadLocation < end && newStart >= 0 && newEnd <= TIMELINE_LENGTH_IN_SECONDS) {
            const playheadPos = (playheadLocation - start) / (end - start);
            const newPlayheadPos = (playheadLocation - newStart) / (newEnd - newStart);
            const translation = (newPlayheadPos - playheadPos) * (newEnd - newStart);

            if (newStart + translation >= 0 && newEnd + translation <= TIMELINE_LENGTH_IN_SECONDS) {
                newStart += translation;
                newEnd += translation;
            } else if (newEnd + translation >= TIMELINE_LENGTH_IN_SECONDS) {
                newEnd = TIMELINE_LENGTH_IN_SECONDS;
                newStart = TIMELINE_LENGTH_IN_SECONDS - WIDTH * newZoom;
            } else {
                newStart = 0;
                newEnd = WIDTH * newZoom;
            }
        }

        state.update('viewport', { startTime: newStart, samplesPerPx: newZoom });
    }

    getPayload(state: State) {
        this.newState = state.getSnapshot();
        return this.newState
    }

    execute(UIEngine: UIEngine, _data?: number | undefined): void {
        UIEngine.draw(Object.values(DOMCommands),this.newState)
    }

}
