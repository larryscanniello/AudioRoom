interface PointerEntries {
    read: Uint32Array,
    write: Uint32Array,
    isFull: Uint32Array,
}

interface Pointers {
    staging: PointerEntries,
    mix: PointerEntries,
    record: PointerEntries,
}

interface Buffers {
    staging: Float32Array,
    mix: Float32Array,
    record: Float32Array,
}

type TimeSignature = {
    numerator: number,
    denominator: number,    
}


export type { Pointers, Buffers, TimeSignature };