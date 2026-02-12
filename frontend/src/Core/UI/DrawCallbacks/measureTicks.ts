import { type StateContainer } from "@/Core/State";  
import { CONSTANTS } from "@/Constants/constants";
   
export function drawMeasureTicks(ref: React.RefObject<HTMLElement>, data: StateContainer, _mipMap: Int8Array){
        const {bpm, timeSignature, viewport} = data;
        if(!(ref.current instanceof HTMLCanvasElement)){
            console.error("Reference in drawMeasureTicks is not a HTMLCanvasElement");
            return
        };
        const tickCtx = ref.current.getContext("2d")!;
        const WIDTH = tickCtx.canvas.width;
        const HEIGHT = tickCtx.canvas.height;
        const pxPerSecond = CONSTANTS.SAMPLE_RATE / viewport.samplesPerPx;
        tickCtx.clearRect(0,0,WIDTH,HEIGHT);
        tickCtx.fillStyle = "rgb(175,175,175)"
        tickCtx.fillRect(0,0,WIDTH,HEIGHT);
        /*if(mouseDragEnd&&snapToGrid){
            tickCtx.fillStyle = "rgb(225,125,0,.25)"
            tickCtx.fillRect(mouseDragStart.trounded*pxPerSecond,0,(mouseDragEnd.trounded-mouseDragStart.trounded)*pxPerSecond,HEIGHT)
        }
        if(mouseDragEnd&&!snapToGrid){
            tickCtx.fillStyle = "rgb(225,125,0,.25)"
            tickCtx.fillRect(mouseDragStart.t*pxPerSecond,0,(mouseDragEnd.t-mouseDragStart.t)*pxPerSecond,HEIGHT)
        }*/
        tickCtx.lineWidth = 5;
        tickCtx.strokeStyle = "rgb(225,225,225)"
        tickCtx.lineWidth = 1;
        tickCtx.font = "12px sans-serif";
        tickCtx.fillStyle = "#1a1a1a";
        const textWidth = tickCtx.measureText("888").width; //888 is the widest number (probably?) so measure that
        
        const ticksPerQuarter = timeSignature.denominator/4;
        const secondsPerTick = 60/bpm/ticksPerQuarter;
        const pxPerMeasure = secondsPerTick * pxPerSecond * timeSignature.numerator;
        
        const resolution = Math.ceil(Math.log2(2*textWidth/pxPerMeasure))+1;

        const startTime = viewport.startTime;
        const startOnBeat = startTime % secondsPerTick;
        const startTickOffset = startOnBeat ? secondsPerTick - startOnBeat : 0;
        const startTickTime = startTickOffset + startTime;
        const startTickPx = startTickOffset * pxPerSecond;
        let beatCount = Math.round(startTickTime/secondsPerTick);
        let x = startTickPx;
        tickCtx.beginPath();
        while(x<WIDTH){
            let beatModulo = beatCount % timeSignature.numerator;
            tickCtx.moveTo(x,HEIGHT);
            if(beatModulo===0){
                let measureCount = 1+Math.floor(beatCount / timeSignature.numerator);
                let measureModulo = (measureCount-1)%(2**resolution);
                if(measureModulo===0){
                    tickCtx.lineTo(x,HEIGHT/2);
                    tickCtx.fillText(String(measureCount),x+2,4*HEIGHT/6);
                }else if(resolution>=1){
                    tickCtx.lineTo(x,5*HEIGHT/6);               
                }
                
            }else if(resolution<1){
                tickCtx.lineTo(x,5*HEIGHT/6);
            }
            x += secondsPerTick*pxPerSecond;
            beatCount += 1;
        }
        tickCtx.stroke();
    }
