import { type StateContainer } from "../State/State";
import { CONSTANTS } from "@/Constants/constants";

export function calculateZoom(
    query:  <K extends keyof StateContainer>(key: K) => StateContainer[K],
    newSliderVal:number,
    width:number
    ): {startTime: number, samplesPerPx: number} {
        /*
            Slider vals are integers between 0 and 1000. 
            Samples per px are values between 10 and a max that depends on window size
            We map between values exponentially. If n is a slider val,
            then the samplesPerPx is 10 * b ** n, where b is chosen such that when n is 1000, 
            samplesPerPx is the max value.
        */
        const maxSamplesPerPx = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * CONSTANTS.SAMPLE_RATE / width;
        const b = (maxSamplesPerPx / 10) ** (1 / 1000);
        const newZoom = 10 * b ** newSliderVal;

        const prevViewPort = query('viewport');
        const prevStart = prevViewPort.startTime;
        const prevEnd = prevStart + width * prevViewPort.samplesPerPx / CONSTANTS.SAMPLE_RATE;
        const center = (prevStart + prevEnd) / 2;

        let newStart, newEnd;
        let possibleNewEnd = center + (width * newZoom / CONSTANTS.SAMPLE_RATE) / 2;
        let possibleNewStart = center - (width * newZoom / CONSTANTS.SAMPLE_RATE) / 2;

        if (possibleNewEnd < CONSTANTS.TIMELINE_LENGTH_IN_SECONDS && possibleNewStart >= 0) {
            newStart = possibleNewStart;
            newEnd = possibleNewEnd;
        } else if (possibleNewEnd >= CONSTANTS.TIMELINE_LENGTH_IN_SECONDS) {
            newEnd = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS;
            newStart = Math.max(0, CONSTANTS.TIMELINE_LENGTH_IN_SECONDS - width * newZoom / CONSTANTS.SAMPLE_RATE);
        } else {
            newStart = 0;
            newEnd = Math.min(CONSTANTS.TIMELINE_LENGTH_IN_SECONDS, width * newZoom / CONSTANTS.SAMPLE_RATE);
        }
        const playheadLocation = query('playheadTimeSeconds');
        if (playheadLocation >= prevStart && playheadLocation < prevEnd && newStart >= 0 && newEnd <= CONSTANTS.TIMELINE_LENGTH_IN_SECONDS) {
            const playheadPos = (playheadLocation - prevStart) / (prevEnd - prevStart);
            const newPlayheadPos = (playheadLocation - newStart) / (newEnd - newStart);
            const translation = (newPlayheadPos - playheadPos) * (newEnd - newStart);
            if (newStart + translation >= 0 && newEnd + translation <= CONSTANTS.TIMELINE_LENGTH_IN_SECONDS) {
                newStart += translation;
                newEnd += translation;
            } else if (newEnd + translation >= CONSTANTS.TIMELINE_LENGTH_IN_SECONDS) {
                newEnd = CONSTANTS.TIMELINE_LENGTH_IN_SECONDS;
                newStart = Math.max(0, CONSTANTS.TIMELINE_LENGTH_IN_SECONDS - width * newZoom / CONSTANTS.SAMPLE_RATE);
            } else {
                newStart = 0;
                newEnd = Math.min(CONSTANTS.TIMELINE_LENGTH_IN_SECONDS, width * newZoom / CONSTANTS.SAMPLE_RATE);
            }
        }
       return { startTime: newStart, samplesPerPx: newZoom };
    }