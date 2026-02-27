
import type { Observer } from "@/Types/Observer";

export interface AudioEngine extends Observer{

    play: (data: any) => void;
    record: (data: any) => void;
    stop: (data: any) => void;
    bounce: (data: any) => void;
    toggleMetronome: () => void;
    otherPersonRecording: (data: any) => void; 
    init(): void;
}