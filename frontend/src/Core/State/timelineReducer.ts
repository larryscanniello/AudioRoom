import type { MipmapRange, Region, TimelineSnapshot, TimelineState } from '../../Types/AudioState';

const MAX_UNDO_DEPTH = 20;
const MIN_REGION_SAMPLES = Math.round(0.01 * 48000);

function snapshot(state: TimelineState, mipmapRanges: MipmapRange[] = []): TimelineSnapshot {
    return { staging: state.staging, mix: state.mix, mipmapRanges };
}

function pushUndo(state: TimelineState, mipmapRanges: MipmapRange[] = []): readonly TimelineSnapshot[] {
    const next = [...state.undoStack, snapshot(state, mipmapRanges)];
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
                id: crypto.randomUUID(),
                start: timelineStart,
                end: timelineEnd,
                bounce: bounceNumber,
                take: takeNumber,
                name: fileName,
                offset: delayCompensation[0],
                clipStart: timelineStart,
                clipEnd: timelineEnd,
            };
            const newStaging = addRegionToStaging(state.staging[0] ?? [], newRegion);
            const mipmapRanges: MipmapRange[] = [{ start: newRegion.start, end: newRegion.end }];
            return {
                staging: [newStaging],
                mix: state.mix,
                undoStack: pushUndo(state, mipmapRanges),
                redoStack: [],
                lastRecordedRegion: newRegion,
                lastMipmapRanges: mipmapRanges,
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
                lastMipmapRanges: [],
            };
        }

        case 'delete_staging_regions': {
            const deleted = state.staging[0] ?? [];
            const mipmapRanges: MipmapRange[] = deleted.length > 0 ? [{
                start: deleted[0].start,
                end: deleted[deleted.length - 1].end,
            }] : [];
            return {
                staging: [[]],
                mix: state.mix,
                undoStack: pushUndo(state, mipmapRanges),
                redoStack: [],
                lastRecordedRegion: null,
                lastMipmapRanges: mipmapRanges,
            };
        }

        case 'delete_mix_regions': {
            return {
                staging: state.staging,
                mix: [],
                undoStack: pushUndo(state),
                redoStack: [],
                lastRecordedRegion: null,
                lastMipmapRanges: [],
            };
        }

        case 'undo': {
            if (state.undoStack.length === 0) return state;
            const prev = state.undoStack[state.undoStack.length - 1];
            return {
                staging: prev.staging,
                mix: prev.mix,
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [...state.redoStack, snapshot(state, [...prev.mipmapRanges])],
                lastRecordedRegion: null,
                lastMipmapRanges: prev.mipmapRanges,
            };
        }

        case 'redo': {
            if (state.redoStack.length === 0) return state;
            const next = state.redoStack[state.redoStack.length - 1];
            return {
                staging: next.staging,
                mix: next.mix,
                undoStack: [...state.undoStack, snapshot(state, [...next.mipmapRanges])],
                redoStack: state.redoStack.slice(0, -1),
                lastRecordedRegion: null,
                lastMipmapRanges: next.mipmapRanges,
            };
        }

        case 'trim_region': {
            const { id, newStart, newEnd } = action;
            const currentStaging = state.staging[0] ?? [];
            const region = currentStaging.find(r => r.id === id);
            if (!region) return state;
            const start = Math.max(region.clipStart, Math.min(newStart, region.end - MIN_REGION_SAMPLES));
            const end = Math.min(region.clipEnd, Math.max(newEnd, region.start + MIN_REGION_SAMPLES));
            const stagingWithout = currentStaging.filter(r => r.id !== id);
            const newStaging = addRegionToStaging(stagingWithout, { ...region, start, end });
            const mipmapRanges: MipmapRange[] = [{ start: Math.min(region.start, start), end: Math.max(region.end, end) }];
            return {
                staging: [newStaging],
                mix: state.mix,
                undoStack: pushUndo(state, mipmapRanges),
                redoStack: [],
                lastRecordedRegion: null,
                lastMipmapRanges: mipmapRanges,
            };
        }

        case 'move_region': {
            const { id, deltaSamples } = action;
            const currentStaging = state.staging[0] ?? [];
            const region = currentStaging.find(r => r.id === id);
            if (!region) return state;
            const newStart = Math.max(0, region.start + deltaSamples);
            const actualDelta = newStart - region.start;
            const movedRegion = {
                ...region,
                start: newStart,
                end: region.end + actualDelta,
                clipStart: region.clipStart + actualDelta,
                clipEnd: region.clipEnd + actualDelta,
            };
            const stagingWithout = currentStaging.filter(r => r.id !== id);
            const newStaging = addRegionToStaging(stagingWithout, movedRegion);
            const mipmapRanges: MipmapRange[] = [{ start: Math.min(region.start, movedRegion.start), end: Math.max(region.end, movedRegion.end) }];
            return {
                staging: [newStaging],
                mix: state.mix,
                undoStack: pushUndo(state, mipmapRanges),
                redoStack: [],
                lastRecordedRegion: null,
                lastMipmapRanges: mipmapRanges,
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
