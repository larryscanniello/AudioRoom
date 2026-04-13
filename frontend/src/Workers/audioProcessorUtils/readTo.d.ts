export declare function readTo(
    reader: Float32Array,
    pointers: { read: Int32Array; write: Int32Array; isFull: Int32Array },
    buffer: Float32Array,
    TRACK_COUNT: number
): boolean;