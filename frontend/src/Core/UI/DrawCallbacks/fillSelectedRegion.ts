import { type StateContainer } from "@/Core/State/State";
import { CONSTANTS } from "@/Constants/constants";

export function fillSelectedRegion(ref: React.RefObject<HTMLElement|null>, data: StateContainer, _mipMap: Int8Array) {
    const { viewport, mouseDragStart, mouseDragEnd, snapToGrid } = data;
    if (!(ref.current instanceof HTMLCanvasElement)) {
        console.error("Reference in fillSelectedRegion is not a HTMLCanvasElement");
        return;
    }
    if (!mouseDragEnd) return;

    const ctx = ref.current.getContext("2d")!;
    const WIDTH = ctx.canvas.width;
    const HEIGHT = ctx.canvas.height;

    const viewportStartTime = viewport.startTime;
    const samplesPerPx = viewport.samplesPerPx;
    const viewportEndTime = viewportStartTime + WIDTH * samplesPerPx / CONSTANTS.SAMPLE_RATE;
    const totalTime = viewportEndTime - viewportStartTime;

    const startT = snapToGrid ? mouseDragStart.trounded : mouseDragStart.t;
    const endT   = snapToGrid ? mouseDragEnd.trounded   : mouseDragEnd.t;
    const selStart = Math.min(startT, endT);
    const selEnd   = Math.max(startT, endT);

    const clampedStart = Math.max(viewportStartTime, selStart);
    const clampedEnd   = Math.min(viewportEndTime,   selEnd);
    if (clampedEnd <= clampedStart) return;

    const rectStartPx = WIDTH * (clampedStart - viewportStartTime) / totalTime;
    const rectEndPx   = WIDTH * (clampedEnd   - viewportStartTime) / totalTime;

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "rgb(252, 200, 3)";
    ctx.fillRect(rectStartPx, 0, rectEndPx - rectStartPx, HEIGHT);
    ctx.globalAlpha = 1;
}