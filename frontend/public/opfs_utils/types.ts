

interface Buffers {
	// One Float32Array per logical buffer, or null before init
	mix: Float32Array | null;
	staging: Float32Array | null;
	record: Float32Array | null;
}

interface PointerTuple {
	read: Uint32Array | null;
	write: Uint32Array | null;
	isFull: Uint32Array | null;
}
interface Pointers {
	mix: PointerTuple;
	staging: PointerTuple;
	record: PointerTuple;
}

interface Region {
	start: number;
	end: number;
	take: number;
	bounce: number;
	name: string;
	offset: number;
}

// Entry for a track in OPFS: directory handle and list of take handles
interface BounceEntry {
	dirHandle: any; // FileSystemDirectoryHandle (use `any` to avoid lib mismatch)
	takeHandles: {[details: string] : any};
}

interface OpfsConfig {
	TRACK_COUNT: number|null;
	MIX_MIPMAP_BUFFER_SIZE_PER_TRACK: number|null;
	MIX_BUFFER_SIZE: number|null;
}

interface OPFS {
	root: any | null;
	sessionDir: any | null;
	bounces: BounceEntry[];
    config: OpfsConfig;
}

// current playback/record indices
interface Curr {
	bounce: number;
	take: number;
}

// timeline and playback state used throughout the worker
interface TimelineState {
	staging: Region[][];      // array of one timeline
	mix: Region[][];        // mix is an array of timelines (per-track)
	start: number;
	end: number;
	pos: {
		staging: number;
		mix: number;
	};
	length?: number; // optional, used in some places
}

// mipmap structure used for waveform visualization
interface MipMap {
	staging: Int8Array | null;
	mix: Int8Array | null;
	isWorking: {
		staging: Int8Array | null;
		mix: Int8Array | null;
	};
	halfSize: number | null;
	resolutions: number[] | null;
	totalTimelineSamples: number | null;
	buffer: Float32Array | null;
}

// simple proceed flags used to drive async loops
type ProceedFlag = 'ready' | 'working' | 'off' | null;
interface Proceed {
	record: ProceedFlag;
	staging: ProceedFlag;
	mix: ProceedFlag;
}

// Small collection of other config / runtime values


// Export everything as a convenience import
export type {
    Buffers,
    Pointers,
	BounceEntry,
	OPFS,
	Curr,
	TimelineState,
	MipMap,
	Proceed,
	OpfsConfig,
    Region,
};

