
export interface Region {
    start: number;
    end: number;
    number: number;
    name: string;
    offset: number;
}

export interface TimelineState {
    readonly regionStack: readonly Region[];
    readonly staging: readonly Region[];
    readonly mix: readonly Region[][];
    readonly redoStack: readonly Region[];
}

interface AddRegionAction {
    type: 'add_region';
    data: {
        timelineStart: number;
        timelineEnd: number;
        takeNumber: number;
        fileName: string;
    };
    delayCompensation: number[];
    fileSystemRef: React.RefObject<Worker>;
}

interface BounceToMixAction {
    type: 'bounce_to_mix';
    fileSystemRef: React.RefObject<Worker>;
}

export type Action = AddRegionAction | BounceToMixAction;