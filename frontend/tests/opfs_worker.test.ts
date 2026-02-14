import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Web Worker global 'self' object to prevent import errors
globalThis.self = globalThis.self || (globalThis as any);

import { writeToOPFSUtil } from '../src/Workers/opfs_utils/writeToOPFSUtil';

/**
 * Comprehensive test suite for writeToOPFSUtil
 *
 * This function writes audio samples from a ring buffer to OPFS storage.
 * It handles:
 * - Ring buffer wrap-around logic
 * - Chunked writes when data crosses buffer boundary
 * - File appending using handle.getSize() for position
 */

describe('writeToOPFSUtil', () => {
    let mockFileHandle: any;
    let audioRes: Float32Array;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock file handle with write and getSize methods
        audioRes = new Float32Array(100);
        let count = 1;
        mockFileHandle = {
            getSize: vi.fn(():number=>10*count++),
            write: vi.fn((subarray:Float32Array,option:{at:number})=>{
                for(let i=0;i<subarray.length;i++){
                    audioRes[option.at + i] = subarray[i];
                };
            })
        };
    });

    describe('Basic write operations', () => {
        it('should write samples without wrap-around', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            const readPtr = 0;
            const writePtr = 0;
            const samplesToWrite = 3;

            const newReadPtr = writeToOPFSUtil(samplesToWrite, buffer, readPtr, writePtr, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalledTimes(1);
            expect(newReadPtr).toBe(3);
            expect(audioRes[10]).toBe(1);
            expect(audioRes[11]).toBe(2);
            expect(audioRes[12]).toBe(3);
        });

        it('should write all samples from buffer', () => {
            const buffer = new Float32Array([7, 8, 9]);
            const newReadPtr = writeToOPFSUtil(3, buffer, 0, 0, mockFileHandle);

            expect(newReadPtr).toBe(0); // Wraps around to 0
            expect(mockFileHandle.write).toHaveBeenCalledTimes(1);
        });

        it('should handle single sample write', () => {
            const buffer = new Float32Array([42]);
            const newReadPtr = writeToOPFSUtil(1, buffer, 0, 0, mockFileHandle);

            expect(newReadPtr).toBe(0);
            expect(mockFileHandle.write).toHaveBeenCalledTimes(1);
            expect(audioRes[10]).toBe(42);
        });
    });

    describe('Ring buffer wrap-around', () => {
        it('should wrap readPtr when reaching buffer end', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            const readPtr = 3;
            const samplesToWrite = 4;

            const newReadPtr = writeToOPFSUtil(samplesToWrite, buffer, readPtr, 2, mockFileHandle);

            expect(newReadPtr).toBe(2); // (3 + 4) % 5 = 2
            expect(mockFileHandle.write).toHaveBeenCalledTimes(2); // Two chunks due to wrap
        });

        it('should handle wrap-around with data split across boundary', () => {
            const buffer = new Float32Array([10, 20, 30, 40, 50]);
            const readPtr = 4; // Near the end
            const samplesToWrite = 3;

            const newReadPtr = writeToOPFSUtil(samplesToWrite, buffer, readPtr, 2, mockFileHandle);

            expect(newReadPtr).toBe(2);
            expect(mockFileHandle.write).toHaveBeenCalledTimes(2);
            console.log('ar',audioRes)
            expect(audioRes[10]).toBe(50); // First write from position 4
            expect(audioRes[20]).toBe(10); // Second write from position 0
            expect(audioRes[21]).toBe(20); // Second write from position 1
        });

        it('should handle multiple wrap-arounds', () => {
            const buffer = new Float32Array([1, 2, 3]);
            const readPtr = 2;
            const samplesToWrite = 8;

            const newReadPtr = writeToOPFSUtil(samplesToWrite, buffer, readPtr, 0, mockFileHandle);

            expect(newReadPtr).toBe(1); // (2 + 8) % 3 = 1
            expect(mockFileHandle.write).toHaveBeenCalled();
        });

        it('should correctly handle writePtr near buffer end', () => {
            const buffer = new Float32Array(10);
            for (let i = 0; i < 10; i++) buffer[i] = i * 10;

            const readPtr = 0;
            const writePtr = 8;
            const samplesToWrite = 5;

            const newReadPtr = writeToOPFSUtil(samplesToWrite, buffer, readPtr, writePtr, mockFileHandle);

            expect(newReadPtr).toBe(5);
            expect(mockFileHandle.write).toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        it('should handle zero samples to write', () => {
            const buffer = new Float32Array([1, 2, 3]);
            const newReadPtr = writeToOPFSUtil(0, buffer, 0, 0, mockFileHandle);

            expect(newReadPtr).toBe(0);
            expect(mockFileHandle.write).not.toHaveBeenCalled();
        });

        it('should handle large buffer with small write', () => {
            const buffer = new Float32Array(1000);
            buffer[500] = 99;
            const newReadPtr = writeToOPFSUtil(1, buffer, 500, 0, mockFileHandle);

            expect(newReadPtr).toBe(501);
            expect(audioRes[10]).toBe(99);
        });

        it('should handle readPtr at buffer end minus one', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            const newReadPtr = writeToOPFSUtil(2, buffer, 4, 0, mockFileHandle);

            expect(newReadPtr).toBe(1);
        });
    });

    describe('File positioning', () => {
        it('should write at correct file position based on getSize', () => {
            const buffer = new Float32Array([100, 200, 300]);
            mockFileHandle.getSize.mockReturnValue(50);

            writeToOPFSUtil(3, buffer, 0, 0, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalledWith(
                expect.any(Float32Array),
                { at: 50 }
            );
        });

        it('should append to end of file for each chunk', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            let fileSize = 0;
            mockFileHandle.getSize.mockImplementation(() => fileSize);
            mockFileHandle.write.mockImplementation((subarray: Float32Array, option: {at: number}) => {
                fileSize += subarray.length;
            });

            writeToOPFSUtil(5, buffer, 0, 0, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalledWith(
                expect.any(Float32Array),
                { at: 0 }
            );
        });

        it('should handle multiple chunks with growing file size', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            let fileSize = 10;
            mockFileHandle.getSize.mockImplementation(() => fileSize);
            mockFileHandle.write.mockImplementation((subarray: Float32Array) => {
                fileSize += subarray.length;
            });

            writeToOPFSUtil(7, buffer, 3, 0, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalledTimes(2);
        });
    });

    describe('Data integrity', () => {

        it('should maintain data order across wrap-around', () => {
            const buffer = new Float32Array([10, 20, 30, 40]);
            writeToOPFSUtil(6, buffer, 3, 1, mockFileHandle);

            expect(audioRes[10]).toBe(40);
            expect(audioRes[20]).toBe(10);
            expect(audioRes[21]).toBe(20);
            expect(audioRes[22]).toBe(30);
        });

        it('should not modify original buffer', () => {
            const buffer = new Float32Array([5, 6, 7, 8]);
            const originalBuffer = new Float32Array(buffer);

            writeToOPFSUtil(3, buffer, 0, 0, mockFileHandle);

            expect(buffer).toEqual(originalBuffer);
        });

        it('should handle negative values correctly', () => {
            const buffer = new Float32Array([-1.5, -2.5, -3.5]);
            writeToOPFSUtil(3, buffer, 0, 0, mockFileHandle);

            expect(audioRes[10]).toBe(-1.5);
            expect(audioRes[11]).toBe(-2.5);
            expect(audioRes[12]).toBe(-3.5);
        });

        it('should handle very small float values', () => {
            const buffer = new Float32Array([0.00001, 0.00002, 0.00003]);
            writeToOPFSUtil(3, buffer, 0, 0, mockFileHandle);

            expect(audioRes[10]).toBeCloseTo(0.00001);
            expect(audioRes[11]).toBeCloseTo(0.00002);
            expect(audioRes[12]).toBeCloseTo(0.00003);
        });
    });

    describe('Pointer arithmetic', () => {
        it('should return correct pointer after exact buffer length write', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            const newReadPtr = writeToOPFSUtil(5, buffer, 0, 0, mockFileHandle);

            expect(newReadPtr).toBe(0);
        });

        it('should handle readPtr starting mid-buffer', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
            const newReadPtr = writeToOPFSUtil(3, buffer, 5, 0, mockFileHandle);

            expect(newReadPtr).toBe(0); // (5 + 3) % 8 = 0
        });

        it('should correctly modulo readPtr for various buffer sizes', () => {
            const testCases = [
                { bufferSize: 10, readPtr: 7, samples: 5, expected: 2 },
                { bufferSize: 16, readPtr: 14, samples: 10, expected: 8 },
                { bufferSize: 100, readPtr: 95, samples: 20, expected: 15 }
            ];

            testCases.forEach(({ bufferSize, readPtr, samples, expected }) => {
                const buffer = new Float32Array(bufferSize);
                const result = writeToOPFSUtil(samples, buffer, readPtr, 0, mockFileHandle);
                expect(result).toBe(expected);
            });
        });
    });

    describe('Chunk writing logic', () => {
        it('should write single chunk when no wrap occurs', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
            writeToOPFSUtil(4, buffer, 0, 2, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalledTimes(1);
        });

        it('should write two chunks when wrap occurs', () => {
            const buffer = new Float32Array([1, 2, 3, 4, 5]);
            writeToOPFSUtil(3, buffer, 4, 0, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalledTimes(2);
        });

        it('should write correct chunk sizes on wrap', () => {
            const buffer = new Float32Array([10, 20, 30, 40, 50]);
            const writeCalls: any[] = [];
            mockFileHandle.write.mockImplementation((subarray: Float32Array) => {
                writeCalls.push(subarray.length);
            });

            writeToOPFSUtil(3, buffer, 4, 0, mockFileHandle);

            expect(writeCalls).toEqual([1, 2]); // First chunk: 1 sample, second chunk: 2 samples
        });

        it('should handle writePtr affecting chunk boundaries', () => {
            const buffer = new Float32Array(20);
            writeToOPFSUtil(15, buffer, 0, 18, mockFileHandle);

            expect(mockFileHandle.write).toHaveBeenCalled();
        });
    });
});