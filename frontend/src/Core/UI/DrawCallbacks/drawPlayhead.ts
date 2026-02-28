import { CONSTANTS } from "@/Constants/constants";
import { type StateContainer } from "@/Core/State/State";
import type { Region } from "@/Types/AudioState";

export function paintPlayhead(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    viewport: { startTime: number; samplesPerPx: number },
    playheadTimeSeconds: number,
    liveRecording: { start: number; end: number } | null,
    stagingRegions: readonly Region[],
): void {
    const containerWidth = canvas.width;
    const startTime = viewport.startTime;
    const samplesPerPx = viewport.samplesPerPx;
    const endTime = startTime + (samplesPerPx * containerWidth) / CONSTANTS.SAMPLE_RATE;

    const stagingHeight = Number(canvas.dataset.stagingheight);
    const mixHeight = Number(canvas.dataset.mixheight);
    if (isNaN(stagingHeight) || isNaN(mixHeight)) {
        console.error("Failed to parse track heights from canvas dataset in paintPlayhead");
        return;
    }

    const containerHeight = canvas.height;
    const regionTop = containerHeight - stagingHeight - mixHeight;
    const playheadHeight = stagingHeight + mixHeight;

    const timeToPx = (t: number) => (t - startTime) / (endTime - startTime) * containerWidth;

    const liveStartSec = liveRecording ? liveRecording.start / CONSTANTS.SAMPLE_RATE : null;
    const liveEndSec = liveRecording ? playheadTimeSeconds : null;

    // Draw live recording region in red
    if (liveStartSec !== null && liveEndSec !== null && liveRecording!.start < liveRecording!.end && (liveEndSec > startTime || liveStartSec < endTime)) {
        const left = Math.max(0, timeToPx(liveStartSec));
        const right = Math.min(containerWidth, timeToPx(liveEndSec));
        ctx.fillStyle = "rgb(180, 30, 30, 0.5)";
        ctx.fillRect(left, regionTop, right - left, stagingHeight);
    }

    // Draw playhead line
    if (playheadTimeSeconds < startTime || playheadTimeSeconds >= endTime) {
        return;
    }

    const playheadPx = timeToPx(playheadTimeSeconds);
    const playheadTop = regionTop;

    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.fillStyle = "red";

    ctx.beginPath();
    ctx.arc(playheadPx, playheadTop - 3.5, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.moveTo(playheadPx, playheadTop);
    ctx.lineTo(playheadPx, playheadTop + playheadHeight);
    ctx.stroke();

    if (liveStartSec !== null && liveEndSec !== null) {
        ctx.fillStyle = "rgb(10, 138, 74, 0.5)";
        for (const region of stagingRegions) {
            const rStart = region.start / CONSTANTS.SAMPLE_RATE;
            const rEnd = region.end / CONSTANTS.SAMPLE_RATE;
            // Only care about middle-split case
            if (liveStartSec > rStart && liveEndSec < rEnd) {
                const left = Math.max(0, timeToPx(liveEndSec));
                const right = Math.min(containerWidth, timeToPx(rEnd));
                ctx.fillRect(left, regionTop, right - left, stagingHeight);
            }
        }
    }
}

export function drawPlayhead(
    ref: React.RefObject<HTMLElement | null>,
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

    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Failed to get canvas context in drawPlayhead");
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintPlayhead(ctx, canvas, data.viewport, data.playheadTimeSeconds, data.liveRecording, data.timeline.staging[0]);
}