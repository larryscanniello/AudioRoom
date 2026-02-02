import type { StateContainer } from "@/Classes/State";
import { SAMPLE_RATE } from "@/Constants/constants";

export function drawCanvasContainer(ref: React.RefObject<HTMLElement>, data: StateContainer, _mipMap: Int8Array){
    const {bpm,timeSignature,viewport} = data;
    if(!(ref.current instanceof HTMLCanvasElement)){
        console.error("Reference in drawCanvasContainer is not a HTMLCanvasElement");
        return
    };
    const canvasContainerCtx = ref.current.getContext("2d")!;
    const WIDTH = canvasContainerCtx.canvas.width;
    const HEIGHT = canvasContainerCtx.canvas.height;
    canvasContainerCtx.clearRect(0,0,WIDTH,HEIGHT);
    canvasContainerCtx.fillStyle = "rgb(200,200,200)"
    canvasContainerCtx.fillRect(0,0,WIDTH,HEIGHT);
    const pxPerSecond = SAMPLE_RATE / viewport.samplesPerPx;
    const drawBeats = () => {
        //draws the lower canvas beat lines

        canvasContainerCtx.lineWidth = 1;
        canvasContainerCtx.strokeStyle = "rgb(175,175,175)";
        canvasContainerCtx.globalAlpha = 1
        canvasContainerCtx.font = "12px sans-serif";
        const textWidth = canvasContainerCtx.measureText("888").width;
        const ticksPerQuarter = timeSignature.denominator/4;
        const secondsPerTick = 60/bpm/ticksPerQuarter;
        
        const pxPerMeasure = secondsPerTick * pxPerSecond * timeSignature.numerator;
        const resolution = Math.ceil(Math.log2(2*textWidth/pxPerMeasure))+1;
        
        const startTime = viewport.startTime;
        const startOnBeat = startTime % secondsPerTick;
        const startTickOffset = startOnBeat ? secondsPerTick - startOnBeat : 0;
        const startTickTime = startTickOffset + startTime;
        const startTickPx = startTickOffset * pxPerSecond;
        let x = startTickPx;
        let beatCount = Math.round(startTickTime/secondsPerTick);
        canvasContainerCtx.beginPath();
        while(x<WIDTH){
            if(resolution<1){
                canvasContainerCtx.moveTo(x,0);
                canvasContainerCtx.lineTo(x,HEIGHT);
            }else{
                let measureCount = Math.floor(beatCount/timeSignature.numerator);
                if(measureCount%(2**resolution)===0 && beatCount % timeSignature.numerator === 0){
                    canvasContainerCtx.moveTo(x,0);
                    canvasContainerCtx.lineTo(x,HEIGHT);
                }
            }
            x += secondsPerTick*pxPerSecond;
            beatCount += 1;
        }
        
    
        canvasContainerCtx.stroke();
        
    }
    drawBeats()
    //draw the line separating the two tracks
    canvasContainerCtx.beginPath();
    canvasContainerCtx.strokeStyle = "rgb(0,0,0)";
    canvasContainerCtx.lineWidth = 1.5;
    canvasContainerCtx.globalAlpha = .3;
    canvasContainerCtx.moveTo(0,HEIGHT/2);
    canvasContainerCtx.lineTo(WIDTH,HEIGHT/2);
    canvasContainerCtx.stroke();
    canvasContainerCtx.globalAlpha = 1;
}