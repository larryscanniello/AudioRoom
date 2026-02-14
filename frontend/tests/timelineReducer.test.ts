import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import timelineReducer from '../src/Core/UI/timelineReducer';
import type { TimelineState, Region, Action } from "../src/Types/AudioState";

export const addRegionTest = (initialRegions: number[][],regionToAdd:number[]) => {
  const postMessage = vi.fn();
  const fileSystemRef = { 
                            current: { postMessage } as unknown as Worker 
                    } as React.RefObject<Worker>;

  const regionStack: Region[] = [];
  for(let i=0;i<initialRegions.length;i++){
    const newRegion:Region = {
        start: initialRegions[i][0],
        end: initialRegions[i][1],
        bounce: 0,
        take: i,
        name: `bounce_${0}_take_${i}`,
        offset: 0,
    };
    regionStack.push(newRegion);
  };
    const prevState: TimelineState = {
        regionStack,
        staging: [],
        mix: [],
        redoStack: [],
    };

    const action:Action = {
        type: 'add_region',
        data: {
            timelineStart: regionToAdd[0],
            timelineEnd: regionToAdd[1],
            takeNumber: regionStack.length,
            bounceNumber: 0,
            fileName: `bounce_${0}_take_${regionStack.length}`,
        },
        delayCompensation: [0],
        fileSystemRef,
    };

    const newState = timelineReducer(prevState, action);
    
  return newState;
}

const getGenericTimelines = (): TimelineState => {
    const regionStack: Region[] = [
      { start: 0, end: 10, take: 0, bounce: 1, name: 'bounce_1_take_0', offset: 0, },
    ];

    const staging: Region[] = [
      { start: 0, end: 10, take: 0, bounce: 1, name: 'bounce_1_take_1', offset: 0, },
    ];

    const mix: Region[][] = [
        [{ start: 0, end: 10, take: 0, bounce: 0, name: 'bounce_0_take_0', offset: 0, }],
    ];

    const redoStack: Region[] = [
        { start: 10, end: 20, take: 0, bounce: 1, name: 'bounce_1_take_0', offset: 0, }
    ];

    return {
      regionStack,
      staging,
      mix,
      redoStack,
    };
}

describe('timelineReducer Scenarios', () => {
    it('correctly adds a region to an empty timeline', () => {
        const initialRegions: number[][] = [];
        const regionToAdd: number[] = [0, 10];
        const newState = addRegionTest(initialRegions, regionToAdd);
        expect(newState.regionStack).toHaveLength(1);
        expect(newState.regionStack[0]).toMatchObject({ start: 0, end: 10 });
        expect(newState.staging).toHaveLength(1);
        expect(newState.staging[0]).toMatchObject({ start: 0, end: 10 });
    });

  it('handles adding regions overlapping at boundary correctly', () => {
    const initialRegions: number[][] = [[0, 10]];
    const regionToAdd: number[] = [10, 20];
    const newState = addRegionTest(initialRegions, regionToAdd);
    const resultArray = newState.regionStack.map((r:Region) => [r.start, r.end]);
    expect(newState.regionStack).toHaveLength(2);
    expect(resultArray).toEqual([[0, 10], [10, 20]]);
  });

  it('splits an existing region when a contained region is added', () => {
    const initial = [[0, 10]];
    const toAdd = [2, 8];
    const newState = addRegionTest(initial, toAdd);

    expect(newState.regionStack).toHaveLength(2);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[0, 2], [2, 8], [8, 10]]);
  });

  it('replaces smaller regions when a larger covering region is added', () => {
    const initial = [[5, 10]];
    const toAdd = [0, 20];
    const newState = addRegionTest(initial, toAdd);

    expect(newState.regionStack).toHaveLength(2);
    expect(newState.staging).toHaveLength(1);
    expect(newState.staging[0]).toMatchObject({ start: 0, end: 20 });
  });

  it('handles partial overlap (new region extends beyond existing end)', () => {
    const initial = [[0, 10]];
    const toAdd = [5, 15];
    const newState = addRegionTest(initial, toAdd);

    // staging should contain the preserved left part of the old region and the new region
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[0, 5], [5, 15]]);
  });

  it('handles a new region overlapping multiple existing regions', () => {
    const initial = [[0, 10], [20, 30]];
    const toAdd = [5, 25];
    const newState = addRegionTest(initial, toAdd);

    // staging should be: [0,5], [5,25], [25,30]
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[0, 5], [5, 25], [25, 30]]);
  });

  it('adds an identical region (same start/end) and keeps only the newest region in staging', () => {
    const initial = [[0, 10]];
    const toAdd = [0, 10];
    const newState = addRegionTest(initial, toAdd);

    // regionStack should have two entries but staging should contain only one shard (the newest)
    expect(newState.regionStack).toHaveLength(2);
    expect(newState.staging).toHaveLength(1);
    expect(newState.staging[0]).toMatchObject({ start: 0, end: 10 });
  });

  it('correctly adds a region that partially overlaps at the start', () => {
    const initial = [[10, 20]];
    const toAdd = [5, 15];
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[5, 15], [15, 20]]);
  });

  it('correctly adds a region that partially overlaps at the end', () => {
    const initial = [[10, 20]];
    const toAdd = [15, 25];
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[10, 15], [15, 25]]);
  });

  it('correctly adds a region that completely overlaps multiple regions', () => {
    const initial = [[0, 10], [15, 25], [30, 40]];
    const toAdd = [5, 35];
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(newState.regionStack).toHaveLength(4);
    expect(startsEnds).toEqual([[0, 5], [5, 35], [35, 40]]);
  });

  it('correctly adds a region that is adjacent to existing regions', () => {
    const initial = [[0, 10], [20, 30]];
    const toAdd = [10, 20];
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(newState.regionStack).toHaveLength(3);
    expect(startsEnds).toEqual([[0, 10], [10, 20], [20, 30]]);
  });

  it('correctly adds a region that overlaps all existing regions', () => {
    const initial = [[10, 20], [30, 40], [50, 60]];
    const toAdd = [0, 70];
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(newState.regionStack).toHaveLength(4);
    expect(startsEnds).toEqual([[0, 70]]);
  });

  it('clears undo stack when adding a new region', () => {
    const initialRegions: number[][] = [[0, 10], [15, 25]];
    const regionToAdd: number[] = [20, 30];
    const newState = addRegionTest(initialRegions, regionToAdd);
    expect(newState.redoStack).toHaveLength(0);
  });

  it('handles adding a region with the same start but different end', () => {
    const initial = [[0, 10]];
    const toAdd = [0, 15];  
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[0, 15]]);
  });   

  it('handles adding a region with the same end but different start', () => {
    const initial = [[0, 10]];
    const toAdd = [5, 10];
    const newState = addRegionTest(initial, toAdd);
    const startsEnds = newState.staging.map((r: any) => [r.start, r.end]);
    expect(startsEnds).toEqual([[0, 5], [5, 10]]);
  });

  it('handles adding a region with zero length', () => {
    
    const prevState = getGenericTimelines();
    

    const postMessage = vi.fn();
    const fileSystemRef = { 
                              current: { postMessage } as unknown as Worker 
                      } as React.RefObject<Worker>;

    const action:Action = {
      type: 'add_region',
      data: {
          timelineStart: 5,
          timelineEnd: 5,
          takeNumber: 1,
          bounceNumber: 0,
          fileName: `track_0_take_2`,
      },
      delayCompensation: [0],
      fileSystemRef,
    };

    const newState = timelineReducer(prevState, action);

    // State should remain unchanged
    expect(newState.regionStack).toHaveLength(1);
    expect(newState.staging).toHaveLength(1);
    expect(newState.mix).toHaveLength(1);
    expect(newState.redoStack).toHaveLength(1);
    expect(newState).toMatchObject(prevState);
  });

  it('handles a region with end less than start', () => {
    
    const prevState = getGenericTimelines(); 
    const postMessage = vi.fn();
    const fileSystemRef = { 
                              current: { postMessage } as unknown as Worker 
                      } as React.RefObject<Worker>;

    const action:Action = {
      type: 'add_region',
      data: {
          timelineStart: 10,
          timelineEnd: 5,
          takeNumber: 1,
          bounceNumber: 0,
          fileName: `track_0_take_2`,
      },
      delayCompensation: [0],
      fileSystemRef,
    };

    const newState = timelineReducer(prevState, action);

    // State should remain unchanged
    expect(newState.regionStack).toHaveLength(1);
    expect(newState.staging).toHaveLength(1);
    expect(newState.mix).toHaveLength(1);
    expect(newState.redoStack).toHaveLength(1);
    expect(newState).toMatchObject(prevState);
  });   

  it('bounces correctly when mix is empty', () => {
    const postMessage = vi.fn();
    const fileSystemRef = { 
                              current: { postMessage } as unknown as Worker 
                      } as React.RefObject<Worker>;

    const regionStack: Region[] = [
      { start: 0, end: 10, take: 0, bounce: 0, name: 'track_0_take_0', offset: 0,},
      { start: 20, end: 30, take: 1, bounce: 0, name: 'track_0_take_1', offset: 0,},
      { start: 40, end: 50, take: 2, bounce: 0, name: 'track_0_take_2', offset: 0,},
      { start: 50, end: 70, take: 3, bounce: 0, name: 'track_0_take_3', offset: 0,},
    ];

    const prevState: TimelineState = {
      regionStack,
      staging: [...regionStack],
      mix: [],
      redoStack: [],
    };

    const action:Action = {
      type: 'bounce_to_mix',
      fileSystemRef,
    };

    const newState = timelineReducer(prevState, action);

    expect(newState.mix).toHaveLength(1);
    expect(newState.mix[0]).toHaveLength(4);
    expect(newState.mix[0].map((r: any)=>[r.start,r.end])).toEqual([[0,10],[20,30],[40,50],[50,70]]);
    expect(newState.regionStack).toHaveLength(0);
    expect(newState.staging).toHaveLength(0);
    expect(newState.redoStack).toHaveLength(0);
    });

});