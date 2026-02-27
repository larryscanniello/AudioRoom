import type { GlobalContext } from "../Mediator";
import { PlayheadMoveAuto } from "../Events/UI/PlayheadMoveAuto";
import { RecordingProgress } from "../Events/Audio/RecordingProgress";
import { CONSTANTS } from "@/Constants/constants";

export class PlayheadManager {
    playheadData: {isMoving:boolean, startTime:number} = {isMoving:false, startTime:0};
    #context: GlobalContext;
    #audioCtx: AudioContext;

     constructor(context: GlobalContext,audioCtx: AudioContext){
        this.#context = context;
        this.#audioCtx = audioCtx;
     }

    playheadLoop(playheadRef:React.RefObject<HTMLElement|null>,
                    waveformRef:React.RefObject<HTMLElement|null>, 
                    timeline: {start: number, end: number}){
        {
            const { isMoving, startTime } = this.playheadData;

            if(!playheadRef.current || !waveformRef.current){
                console.error("Playhead or waveform ref not found during playhead loop");
                return;
            }
            
            const audioCtx = this.#audioCtx;
            const elapsed = audioCtx.currentTime - startTime;
            const looping = this.#context.query("isLooping");

            let newPlayheadTime;
            if(looping){
                newPlayheadTime = timeline.start + (elapsed % (timeline.end - timeline.start));
            }else{
                newPlayheadTime = Math.min(timeline.start + elapsed, timeline.end);
            }

            this.#context.dispatch(PlayheadMoveAuto.getDispatchEvent({ param: newPlayheadTime, emit: false }));
            if(this.#context.query("isRecording")){
                const param = {start: timeline.start * CONSTANTS.SAMPLE_RATE, end: newPlayheadTime * CONSTANTS.SAMPLE_RATE};
                this.#context.dispatch(RecordingProgress.getDispatchEvent({ param, emit: false }));
            }

            if(isMoving){
                requestAnimationFrame(() => this.playheadLoop(playheadRef, waveformRef,timeline));
            }
        }
    }

    stop(){
        this.playheadData.isMoving = false;
    }

}