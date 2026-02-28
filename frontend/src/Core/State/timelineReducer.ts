import type { Region, TimelineSnapshot, TimelineState } from '../../Types/AudioState';

const MAX_UNDO_DEPTH = 20;

function snapshot(state: TimelineState): TimelineSnapshot {
    return { staging: state.staging, mix: state.mix };
}

function pushUndo(state: TimelineState): readonly TimelineSnapshot[] {
    const next = [...state.undoStack, snapshot(state)];
    return next.length > MAX_UNDO_DEPTH ? next.slice(next.length - MAX_UNDO_DEPTH) : next;
}

function clipAgainst(existing: Region, newRegion: Region): Region[] {
    if (existing.end <= newRegion.start || existing.start >= newRegion.end) {
        return [existing];
    }
    const parts: Region[] = [];
    if (existing.start < newRegion.start) {
        parts.push({ ...existing, end: newRegion.start });
    }
    if (existing.end > newRegion.end) {
        parts.push({ ...existing, start: newRegion.end });
    }
    return parts;
}

function addRegionToStaging(staging: readonly Region[], newRegion: Region): Region[] {
    const result: Region[] = [];
    for (const r of staging) {
        result.push(...clipAgainst(r, newRegion));
    }
    result.push(newRegion);
    result.sort((a, b) => a.start - b.start);
    return result;
}

export default function timelineReducer(state: TimelineState, action: any): TimelineState {
    switch (action.type) {

        case 'add_region': {
            const { timelineStart, timelineEnd, takeNumber, fileName, bounceNumber, delayCompensation } = action.data;
            if (timelineEnd <= timelineStart) {
                console.error('Invalid region: end must be greater than start');
                return state;
            }
            const newRegion: Region = {
                start: timelineStart,
                end: timelineEnd,
                bounce: bounceNumber,
                take: takeNumber,
                name: fileName,
                offset: delayCompensation[0],
            };
            const newStaging = addRegionToStaging(state.staging[0] ?? [], newRegion);
            return {
                staging: [newStaging],
                mix: state.mix,
                undoStack: pushUndo(state),
                redoStack: [],
                lastRecordedRegion: newRegion,
            };
        }

        case 'bounce_to_mix': {
            // Bounce is intentionally NOT undoable — it triggers OPFS audio rendering.
            // Clear both stacks so the user cannot undo past a bounce.
            return {
                staging: [[]],
                mix: [...state.mix, [...(state.staging[0] ?? [])]],
                undoStack: [],
                redoStack: [],
                lastRecordedRegion: null,
            };
        }

        case 'delete_staging_regions': {
            return {
                staging: [[]],
                mix: state.mix,
                undoStack: pushUndo(state),
                redoStack: [],
                lastRecordedRegion: null,
            };
        }

        case 'delete_mix_regions': {
            return {
                staging: state.staging,
                mix: [],
                undoStack: pushUndo(state),
                redoStack: [],
                lastRecordedRegion: null,
            };
        }

        case 'undo': {
            if (state.undoStack.length === 0) return state;
            const prev = state.undoStack[state.undoStack.length - 1];
            return {
                staging: prev.staging,
                mix: prev.mix,
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [...state.redoStack, snapshot(state)],
                lastRecordedRegion: null,
            };
        }

        case 'redo': {
            if (state.redoStack.length === 0) return state;
            const next = state.redoStack[state.redoStack.length - 1];
            return {
                staging: next.staging,
                mix: next.mix,
                undoStack: [...state.undoStack, snapshot(state)],
                redoStack: state.redoStack.slice(0, -1),
                lastRecordedRegion: null,
            };
        }

        default:
            if (import.meta.env.PRODUCTION) {
                return state;
            } else {
                throw new Error(`Unhandled action type: ${(action as any).type}`);
            }
    }
}