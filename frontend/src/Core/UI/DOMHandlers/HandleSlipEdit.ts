import type { GlobalContext } from "@/Core/Mediator";
import { SetLiveSlip } from "@/Core/Events/UI/SetLiveSlip";
import { UpdateRegionOffset } from "@/Core/Events/Audio/UpdateRegionOffset";
import timelineReducer from "@/Core/State/timelineReducer";
import { CONSTANTS } from "@/Constants/constants";


export class HandleSlipEdit {
    #context: GlobalContext;

    constructor(context: GlobalContext) {
        this.#context = context;
    }

    slipMouseDown(e: React.MouseEvent, regionId: string, baselineOffset: number) {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;

        // Capture clip bounds for clamping at drag start
        const maxOffset = Math.round(0.4 * CONSTANTS.SAMPLE_RATE)
        const clamp = (offset: number) => Math.max(0, Math.min(maxOffset, offset));

        const handleMouseMove = (mv: MouseEvent) => {
            const deltaX = mv.clientX - startX;
            const timelineSamplesPerPx = this.#context.query('viewport').samplesPerPx;
            const samplesPerDragPx = timelineSamplesPerPx * 0.5;
            const rawOffset = baselineOffset + Math.round(deltaX * samplesPerDragPx);
            const delta = clamp(rawOffset) - baselineOffset;
            this.#context.dispatch(SetLiveSlip.getDispatchEvent({
                emit: false,
                param: { regionId, delta },
            }));
        };

        const handleMouseUp = () => {
            const liveDelta = this.#context.query('liveSlip')?.delta ?? 0;
            const newOffset = clamp(baselineOffset + liveDelta);
            const timeline = this.#context.query('timeline');
            const newTimeline = timelineReducer(timeline, {
                type: 'update_region_offset',
                regionId,
                newOffset,
            });
            this.#context.dispatch(UpdateRegionOffset.getDispatchEvent({
                emit: true,
                param: newTimeline,
            }));
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
}
