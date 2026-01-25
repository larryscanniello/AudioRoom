import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fillPlaybackBufferUtil } from '../public/opfs_utils/fillPlaybackBufferUtil.ts'; // Update this path
import type { TimelineState, TrackEntry, Region } from '../public/opfs_utils/types.ts';


function createMockTimeline(regionsToAdd: number[][][], timelineStart: number, timelineEnd: number) {
    
    const mix: Region[][] = regionsToAdd.map(trackRegions => 
        trackRegions.map(([start, end],j) => ({
            start, end,
            number: j,
            name: "mock-region",
            offset: 0,
        }))
    );

    const tracks: TrackEntry[] = regionsToAdd.map((trackRegions, i) => ({
        dirHandle: null,
        takeHandles: trackRegions.map((_, j) => ({
            read: vi.fn(async (view: Float32Array, options: { at: number }) => {
                // Fill buffer with a predictable value based on track/region
                // Example: Track 0, Region 1 fills with 0.1
                const signalValue = (i + 1) * 0.01 + (j + 1) * 0.001;;
                
                for (let i = 0; i < view.length; i++) {
                    view[i] = signalValue;
                }
                
                return { bytesRead: view.byteLength }; // Real OPFS handles usually return metadata
            })
        }))
    }));

    const timeline: TimelineState = {
        pos: { mix: timelineStart, staging: 0 },
        start: timelineStart,
        end: timelineEnd,
        mix: mix,
        staging: [],
    };

    return { timeline, tracks };
}

describe('fillPlaybackBufferUtil', () => {
    const TRACK_COUNT = 2;
    const TRACK_BUFFER_LEN = 100;
    const TOTAL_BUFFER_SIZE = TRACK_BUFFER_LEN * TRACK_COUNT;
    let buffer: Float32Array;

    beforeEach(() => {
        buffer = new Float32Array(TOTAL_BUFFER_SIZE).fill(0);
    });

    it('fills silence when the timeline position is before any regions', () => {
        // Track 0 has one region starting at 50. Timeline starts at 0.
        const { timeline, tracks } = createMockTimeline([[[50, 100]]], 0, 100);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        // Track 0, first 50 samples should be silence (0)
        const track0Part = buffer.subarray(0, 50);
        expect(track0Part.every(v => v === 0)).toBe(true);
        
        // Track 0, next 50 samples should be region data (0.011)
        const track0Data = buffer.subarray(50, 100);
        track0Data.forEach(v => expect(v).toBeCloseTo(0.011));
        
        expect(result.timelinePos).toBe(100);
    });

    it('fills silence when the timeline position is after all regions', () => {
        // Track 0 has one region from 0-50. Timeline starts at 60.
        const { timeline, tracks } = createMockTimeline([[[0, 50]]], 0, 100);

        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        // Track 0, first 50 samples should be region data (0.011)
        const track0Data = buffer.subarray(0, 50);
        track0Data.forEach(v => expect(v).toBeCloseTo(0.011));

        // Track 0, next 50 samples should be silence (0)
        const track0Silence = buffer.subarray(50, 100);
        expect(track0Silence.every(v => v === 0)).toBe(true);

        expect(result.timelinePos).toBe(100);
    });

    it('fills silence for gaps between regions; handles two regions on same track', () => {
        // Track 0 has regions [0-30] and [60-90]. Timeline starts at 0.
        const { timeline, tracks } = createMockTimeline([[[0, 30], [60, 90]]], 0, 100);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        // Track 0, first 30 samples should be region data (0.011)
        const track0Part1 = buffer.subarray(0, 30);
        track0Part1.forEach(v => expect(v).toBeCloseTo(0.011));

        // Next 30 samples (30-60) should be silence (0)
        const track0Silence = buffer.subarray(30, 60);
        expect(track0Silence.every(v => v === 0)).toBe(true);

        // Next 30 samples (60-90) should be region data (0.011)
        const track0Part2 = buffer.subarray(60, 90);
        track0Part2.forEach(v => expect(v).toBeCloseTo(0.012));

        // Last 10 samples (90-100) should be silence (0)
        const track0EndSilence = buffer.subarray(90, 100);
        expect(track0EndSilence.every(v => v === 0)).toBe(true);

        expect(result.timelinePos).toBe(100);
    });
  
  
    it('correctly handles overlapping regions across multiple tracks', () => {
        // Track 0: [0-100], Track 1: [0-100]

        const { timeline, tracks } = createMockTimeline([[[0, TRACK_BUFFER_LEN]], [[0, TRACK_BUFFER_LEN]]], 0, 100);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        buffer.subarray(0, 100).forEach(v => expect(v).toBeCloseTo(0.011));
        buffer.subarray(100, 200).forEach(v => expect(v).toBeCloseTo(0.021));
        
    });

    it('correctly handles non-overlapping regions across multiple tracks',() => {

      const { timeline, tracks } = createMockTimeline([[[0,25]],[[50,75]]],0,100);

      const result = fillPlaybackBufferUtil(buffer,TRACK_COUNT,0,0,timeline, tracks,false);

      buffer.subarray(0,25).forEach(v => expect(v).toBeCloseTo(0.011));
      buffer.subarray(25,150).forEach(v => expect(v).toBe(0));
      buffer.subarray(150,175).forEach(v => expect(v).toBeCloseTo(.021));
      buffer.subarray(175,200).forEach(v => expect(v).toBe(0));
    })

        
    it('wraps the write pointer correctly in the ring buffer', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 100]]], 0, 100);
        
        // Start writing at index 80. Buffer length per track is 100.
        // It should write 20 samples to [80-99] and 80 samples to [0-79]
        const writePtr = 80;
        const readPtr = 80; // This tells the util it has 100 samples of "available" space
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, writePtr, readPtr, timeline, tracks, false);

        expect(result.newWritePtr).toBe(80); // Wrapped around fully
        buffer.subarray(0,100).forEach(v => expect(v).toBeCloseTo(.011))
    });

    
    it('respects the timeline.end boundary', () => {
        // Region goes to 200, but timeline ends at 50
        const { timeline, tracks } = createMockTimeline([[[0, 200]],[[0,200]]], 0, 50);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        // It should only have advanced 50 samples because of timeline.end
        buffer.subarray(0,50).forEach(v => expect(v).toBeCloseTo(.011,5));
        buffer.subarray(50,100).forEach(v => expect(v).toBe(0));
        buffer.subarray(100,150).forEach(v => expect(v).toBeCloseTo(.021,5));
        buffer.subarray(150,200).forEach(v => expect(v).toBe(0));
    });

    
    it('loops back to timeline.start when looping is true and correctly fills buffer with multiple tracks', () => {
        // Timeline is 0-100. Current pos is 90. We want to fill 20 samples.
        const { timeline, tracks } = createMockTimeline([[[90, 95],[95,100]],[[90,93],[93,100]]], 90, 100);
        
        // available space = 20
        const writePtr = 10;
        const readPtr = 30; // 100 - 80 = 20 samples available

        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, writePtr, readPtr, timeline, tracks, true);

        buffer.subarray(0,10).forEach(v => expect(v).toBe(0));
        buffer.subarray(10,15).forEach(v => expect(v).toBeCloseTo(.011,5));
        buffer.subarray(15,20).forEach(v => expect(v).toBeCloseTo(.012,5))
        buffer.subarray(20,25).forEach(v => expect(v).toBeCloseTo(.011,5));
        buffer.subarray(25,30).forEach(v => expect(v).toBeCloseTo(.012,5));
        buffer.subarray(110,113).forEach(v => expect(v).toBeCloseTo(.021,5));
        buffer.subarray(113,120).forEach(v => expect(v).toBeCloseTo(.022,5));
        buffer.subarray(120,123).forEach(v => expect(v).toBeCloseTo(.021,5));
        buffer.subarray(123,130).forEach(v => expect(v).toBeCloseTo(.022,5));
        buffer.subarray(130,200).forEach(v => expect(v).toBe(0));
        expect(result.timelinePos).toBe(90);
    });

    it('handles a completely empty timeline (no regions)', () => {
        const { timeline, tracks } = createMockTimeline([[]], 0, 100);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        expect(buffer.every(v => v === 0)).toBe(true);
        expect(result.timelinePos).toBe(100);
        expect(result.newWritePtr).toBe(0);
    });

    
    it('handles regions that are exactly 1 sample long (boundary check)', () => {
        // Region only exists at index 10
        const { timeline, tracks } = createMockTimeline([[[10, 11]]], 0, 100);
        
        fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        expect(buffer[9]).toBe(0);
        expect(buffer[10]).toBeCloseTo(0.011);
        expect(buffer[11]).toBe(0);
    });

    it('successfully skips a track if it has no regions but others do', () => {
        // Track 0: Empty, Track 1: Full
        const { timeline, tracks } = createMockTimeline([[], [[0, 100]]], 0, 100);
        const twoTrackBuffer = new Float32Array(200).fill(0);
        
        fillPlaybackBufferUtil(twoTrackBuffer, 2, 0, 0, timeline, tracks, false);

        // Track 0 (0-99) silence
        expect(twoTrackBuffer.subarray(0, 100).every(v => v === 0)).toBe(true);
        // Track 1 (100-199) data
        twoTrackBuffer.subarray(100, 200).forEach(v => expect(v).toBeCloseTo(.021));
    });

    
    it('handles a timeline.start that is not zero', () => {
        // Playback starts at 500, timeline start is 500, region is 510-520
        const { timeline, tracks } = createMockTimeline([[[510, 520]]], 500, 600);
        
        fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);

        expect(buffer.subarray(0, 10).every(v => v === 0)).toBe(true); // 500-510
        expect(buffer.subarray(10, 20).every(v => v > 0)).toBe(true);  // 510-520
        expect(buffer.subarray(20, 100).every(v => v === 0)).toBe(true); // 520-600
    });

    

    it('handles "Large Buffer" scenario: multiple loop-arounds in one call', () => {
        // Timeline is very short (10 samples), but buffer is long (100 samples)
        // With looping=true, it should cycle 10 times.
        const { timeline, tracks } = createMockTimeline([[[0, 5]]], 0, 10);
        
        fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, true);

        // Every 10 samples, we should see 5 samples of data and 5 samples of silence
        for (let i = 0; i < 10; i++) {
            const start = i * 10;
            expect(buffer.subarray(start, start + 5).every(v => v > 0)).toBe(true);
            expect(buffer.subarray(start + 5, start + 10).every(v => v === 0)).toBe(true);
        }
    });


    it('does not crash if a takeHandle is missing for a region and correctly fills in silence', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 50],[50,100]]], 0, 100);
        // Simulate a corrupted track state where takeHandles doesn't match regions
        tracks[0].takeHandles = [{
            read: vi.fn(async (view: Float32Array, options: { at: number }) => {
                // Fill buffer with a predictable value based on track/region
                // Example: Track 0, Region 1 fills with 0.1
                const signalValue = .11;
                
                for (let i = 0; i < view.length; i++) {
                    view[i] = signalValue;
                }})}]; 

        const call = () => fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        
        const results = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        // It should either throw a helpful error or gracefully handle it (fill silence)
        // Adjust expectation based on your actual error handling strategy
        expect(call).not.toThrow();
        expect(buffer.subarray(50,100).every(v => v === 0)).toBe(true);
        buffer.subarray(0,50).forEach(v => expect(v).toBeCloseTo(.11,5))
    });

    
    it('handles partial buffer fills when available space is limited', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 100]],[[0,100]]], 0, 100);
        
        // Only 30 samples available (writePtr=0, readPtr=70)
        const writePtr = 0;
        const readPtr = 50;
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, writePtr, readPtr, timeline, tracks, false);
        
        // Should only fill 30 samples
        buffer.subarray(0, 50).forEach(v => expect(v).toBeCloseTo(0.011,5));
        buffer.subarray(50, 100).forEach(v => expect(v).toBe(0));
        buffer.subarray(100,150).forEach(v => expect(v).toBeCloseTo(.021,5));
        buffer.subarray(150,200).forEach(v => expect(v).toBe(0));
        expect(result.timelinePos).toBe(50);
    });


    it('handles region that starts exactly at timeline position', () => {
        const { timeline, tracks } = createMockTimeline([[[50, 100]]], 50, 100);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        
        // All 50 samples should be filled with data, no leading silence
        buffer.subarray(0, 50).forEach(v => expect(v).toBeCloseTo(0.011));
        expect(result.timelinePos).toBe(100);
    });


    it('handles region that ends exactly at timeline.end and timeline start is greater than region start', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 100]]], 25, 100);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        
        buffer.subarray(0, 75).forEach(v => expect(v).toBeCloseTo(0.011));
        buffer.subarray(75,100).forEach(v => expect(v).toBe(0));
        expect(result.timelinePos).toBe(100);
    });


    it('handles three tracks correctly', () => {
        const { timeline, tracks } = createMockTimeline(
            [[[0, 50]], [[25, 75]], [[50, 100]]], 
            0, 
            100
        );
        const threeTrackBuffer = new Float32Array(300).fill(0);
        
        fillPlaybackBufferUtil(threeTrackBuffer, 3, 0, 0, timeline, tracks, false);
        
        // Track 0: data 0-50, silence 50-100
        threeTrackBuffer.subarray(0, 50).forEach(v => expect(v).toBeCloseTo(0.011));
        expect(threeTrackBuffer.subarray(50, 100).every(v => v === 0)).toBe(true);
        
        // Track 1: silence 0-25, data 25-75, silence 75-100
        expect(threeTrackBuffer.subarray(100, 125).every(v => v === 0)).toBe(true);
        threeTrackBuffer.subarray(125, 175).forEach(v => expect(v).toBeCloseTo(0.021));
        expect(threeTrackBuffer.subarray(175, 200).every(v => v === 0)).toBe(true);
        
        // Track 2: silence 0-50, data 50-100
        expect(threeTrackBuffer.subarray(200, 250).every(v => v === 0)).toBe(true);
        threeTrackBuffer.subarray(250, 300).forEach(v => expect(v).toBeCloseTo(0.031));
    });

    it('handles writePtr near end of buffer with small wrap', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 1],[1,100]]], 0, 100);
        
        const writePtr = 99;
        const readPtr = 99;
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, writePtr, readPtr, timeline, tracks, false);
        
        // Should write 5 samples at end, 95 at beginning
        buffer.subarray(99, 100).forEach(v => expect(v).toBeCloseTo(0.011,5));
        buffer.subarray(0, 99).forEach(v => expect(v).toBeCloseTo(0.012,5));
        expect(result.newWritePtr).toBe(99);
    });


    it('handles loop from end of timeline with partial fill in second loop', () => {
        // Timeline 0-50, start at position 40, fill 30 samples with looping
        const { timeline, tracks } = createMockTimeline([[[0, 12],[12,50]]], 0, 50);
        timeline.pos.mix = 40;
        
        const writePtr = 0;
        const readPtr = 30;
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, writePtr, readPtr, timeline, tracks, true);
        
        // First 10 samples: timeline 40-50
        buffer.subarray(0, 10).forEach(v => expect(v).toBeCloseTo(0.012,5));
        // Next 20 samples: looped back, timeline 0-20
        buffer.subarray(10, 22).forEach(v => expect(v).toBeCloseTo(0.011,5));
        // Rest should be untouched
        buffer.subarray(22, 30).forEach(v => expect(v).toBeCloseTo(0.012,5));
        buffer.subarray(30, 200).forEach(v => expect(v).toBe(0));
        expect(result.timelinePos).toBe(20);
    });

    
    it('handles region offset correctly when reading from take', () => {
        const { timeline, tracks } = createMockTimeline([[[20, 40]]], 0, 100);
        
        timeline.mix[0][0].offset = 10;
        
        const readSpy = tracks[0].takeHandles[0].read;

        console.log('readSpy',readSpy)
        
        fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        
        const firstCall = readSpy.mock.calls[0];
        expect(firstCall[1].at).toBe(10 * Float32Array.BYTES_PER_ELEMENT); // offset should be added to read position
    });

    it('stops filling when timeline position exceeds timeline.end in non-looping mode', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 200]]], 0, 50);
        
        const result = fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        
        // Should stop at timeline.end (50), not continue to buffer end (100)
        buffer.subarray(0, 50).forEach(v => expect(v).toBeCloseTo(0.011));
        buffer.subarray(50, 100).forEach(v => expect(v).toBe(0));
        expect(result.timelinePos).toBe(50);
    });


    it('handles consecutive calls correctly maintaining state', () => {
        const { timeline, tracks } = createMockTimeline([[[0, 100]]], 0, 100);
        
        // First call: fill 50 samples
        const firstResult = fillPlaybackBufferUtil(
            buffer, 
            TRACK_COUNT, 
            0, 
            50, 
            timeline, 
            tracks, 
            false
        );
        
        buffer.subarray(0, 50).forEach(v => expect(v).toBeCloseTo(0.011));
        expect(firstResult.timelinePos).toBe(50);
        expect(firstResult.newWritePtr).toBe(50);
        
        // Second call: fill remaining 50 samples
        timeline.pos.mix = firstResult.timelinePos;
        const secondResult = fillPlaybackBufferUtil(
            buffer, 
            TRACK_COUNT, 
            firstResult.newWritePtr, 
            0, 
            timeline, 
            tracks, 
            false
        );
        
        buffer.subarray(50, 100).forEach(v => expect(v).toBeCloseTo(0.011));
        expect(secondResult.timelinePos).toBe(100);
        expect(secondResult.newWritePtr).toBe(0); // Wrapped
    });


    it('correctly handles multiple gaps and regions on a single track', () => {
        // Track with regions: [10-20], [30-40], [50-60], [70-80]
        const { timeline, tracks } = createMockTimeline(
            [[[10, 20], [30, 40], [50, 60], [70, 80]]], 
            0, 
            100
        );
        
        fillPlaybackBufferUtil(buffer, TRACK_COUNT, 0, 0, timeline, tracks, false);
        
        // Silence 0-10
        expect(buffer.subarray(0, 10).every(v => v === 0)).toBe(true);
        // Data 10-20
        buffer.subarray(10, 20).forEach(v => expect(v).toBeCloseTo(0.011));
        // Silence 20-30
        expect(buffer.subarray(20, 30).every(v => v === 0)).toBe(true);
        // Data 30-40
        buffer.subarray(30, 40).forEach(v => expect(v).toBeCloseTo(0.012));
        // Silence 40-50
        expect(buffer.subarray(40, 50).every(v => v === 0)).toBe(true);
        // Data 50-60
        buffer.subarray(50, 60).forEach(v => expect(v).toBeCloseTo(0.013));
        // Silence 60-70
        expect(buffer.subarray(60, 70).every(v => v === 0)).toBe(true);
        // Data 70-80
        buffer.subarray(70, 80).forEach(v => expect(v).toBeCloseTo(0.014));
        // Silence 80-100
        expect(buffer.subarray(80, 100).every(v => v === 0)).toBe(true);
    });
});