import { type StateContainer } from "@/Core/State/State";

export function fillSelectedRegion(ref: React.RefObject<HTMLElement|null>, data:StateContainer,_mipMap: Int8Array){
        const {viewport, mouseDragStart, mouseDragEnd} = data;
        if(!(ref.current instanceof HTMLCanvasElement)){
            console.error("Reference in fillSelectedRegion is not a HTMLCanvasElement");
            return
        };
        return
        const canvasCtx = ref.current.getContext("2d")!;
        const WIDTH = canvasCtx.canvas.width;
        const HEIGHT = canvasCtx.canvas.height;
        canvasCtx.clearRect(0,0,WIDTH,HEIGHT);   
        canvasCtx.globalAlpha = .2
        const viewportStartTime = viewport.startTime;
        const samplesPerPx = viewport.samplesPerPx;
        const viewportEndTime = viewportStartTime + WIDTH * samplesPerPx;
        const totalTime = viewportEndTime - viewportStartTime;
        const rectStart = Math.max(viewportStartTime,mouseDragStart.trounded);
        if(!mouseDragEnd) return;
        const rectEnd = Math.min(viewportEndTime,mouseDragEnd.trounded);
        if(rectEnd < viewportStartTime || rectStart > viewportEndTime) return;
        const rectStartPx = WIDTH * (rectStart-viewportStartTime)/totalTime;
        const rectEndPx = WIDTH * (rectEnd - viewportStartTime)/totalTime;
        canvasCtx.fillStyle = "rgb(75,75,75,.5)"
        canvasCtx.fillRect(rectStartPx,0,rectEndPx-rectStartPx,HEIGHT);
    }