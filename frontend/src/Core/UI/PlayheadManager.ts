import type { GlobalContext } from "../Mediator";
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
            const rect = waveformRef.current.getBoundingClientRect();
            const width = rect.width;
            const viewport = this.#context.query("viewport");
            const viewportStart = viewport.startTime;
            const viewportEnd = viewportStart + width * viewport.samplesPerPx / CONSTANTS.SAMPLE_RATE;
            
            const audioCtx = this.#audioCtx;
            const elapsed = audioCtx.currentTime - startTime;
            const looping = this.#context.query("isLooping");

            let newPlayheadTime;
            if(looping){
                newPlayheadTime = timeline.start + ((elapsed + startTime) % (timeline.end - timeline.start));
            }else{
                newPlayheadTime = Math.min(timeline.start + elapsed, timeline.end);
            }

            if(newPlayheadTime >= viewportEnd || newPlayheadTime < viewportStart){
                playheadRef.current.style.display = "none";
            }else{
                playheadRef.current.style.display = "block";
                const playheadRatio = (newPlayheadTime - viewportStart) / (viewportEnd - viewportStart);
                const offset = playheadRatio * width;
                playheadRef.current.style.left = `${offset}px`;
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