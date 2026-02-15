import { CONSTANTS } from "@/Constants/constants";
import { type StateContainer } from "@/Core/State";

export function drawPlayhead(
    ref: React.RefObject<HTMLCanvasElement | null>,
    data: StateContainer,
    _mipMap: Int8Array,
) {
    if (!ref.current) {
        console.error("Reference in drawPlayhead is not available");
        return;
    }
    if (!(ref.current instanceof HTMLCanvasElement)) {
        console.error("Reference in drawPlayhead is not an HTMLCanvasElement");
        return;
    }

    const { viewport, playheadTimeSeconds } = data;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        console.error("Failed to get canvas context in drawPlayhead");
        return;
    }

    const containerWidth = canvas.width;
    const startTime = viewport.startTime;
    const samplesPerPx = viewport.samplesPerPx;
    const endTime = startTime + (samplesPerPx * containerWidth) / CONSTANTS.SAMPLE_RATE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (playheadTimeSeconds < startTime || playheadTimeSeconds >= endTime) {
        return;
    }

    const playheadViewportTime = (playheadTimeSeconds - startTime) / (endTime - startTime);
    const playheadPx = playheadViewportTime * containerWidth;

    const stagingHeight = Number(canvas.dataset.stagingheight);
    const mixHeight = Number(canvas.dataset.mixheight);
    if(isNaN(stagingHeight) || isNaN(mixHeight)){
        console.error("Failed to parse track heights from canvas dataset in drawPlayhead");
        return;
    }
    const playheadHeight = stagingHeight + mixHeight;

    const containerHeight = canvas.height;
    const playheadTop = containerHeight - stagingHeight - mixHeight;

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.fillStyle = "red";


    ctx.beginPath();

    ctx.arc(playheadPx, playheadTop-3.5, 3.5, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.moveTo(playheadPx, playheadTop);
    ctx.lineTo(playheadPx, playheadTop + playheadHeight);
    ctx.stroke();
}