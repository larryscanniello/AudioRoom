type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

type IntegerTypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array;

type RingSABPointers = {
    read: IntegerTypedArray[];
    write: IntegerTypedArray;
    isFull: IntegerTypedArray;
}

type PointerArgs = {
    read: IntegerTypedArray;
    read2?: IntegerTypedArray;
    write: IntegerTypedArray;
    isFull: IntegerTypedArray;
}

export class RingSAB {
    #sab: TypedArray;
    #pointers: RingSABPointers;
    #instanceReadPtr: IntegerTypedArray | null;

    constructor(sab: TypedArray, pointers: PointerArgs, readPtr?: IntegerTypedArray) {
        this.#sab = sab;
        this.#pointers = {
            read: [pointers.read],
            write: pointers.write,
            isFull: pointers.isFull,
        }
        if (pointers.read2) {
            this.#pointers.read.push(pointers.read2);
        }
        this.#instanceReadPtr = readPtr ?? null;
    }

    getBuffer(): TypedArray {
        return this.#sab;
    }

    get length(): number {
        return this.#sab.length;
    }

    availableSamplesToWrite(): number {
        const isFull = this.isFull();
        if (isFull) {
            return 0;
        }
        const readPtrs = this.getAllReadPointers();
        const writePtr = this.getWritePointer();
        if (readPtrs.length === 0) {
            return this.#sab.length;
        }
        let availableSamples = this.#sab.length;
        readPtrs.forEach((readPtr: number) => {
            availableSamples = Math.min(availableSamples, (readPtr - writePtr + this.#sab.length) % this.#sab.length);
        });
        return availableSamples;
    }

    availableSamplesToRead(): number {
        const readPtr = this.getInstanceReadPointer();
        if (readPtr === null) {
            throw new Error("No instance read pointer provided for this RingSAB");
        }
        const writePtr = this.getWritePointer();
        const isFull = this.isFull();
        if (readPtr === writePtr && isFull) return this.#sab.length;
        return (writePtr - readPtr + this.#sab.length) % this.#sab.length;
    }

    read(readerToWriteTo: TypedArray, offset: number, numbersToWrite: number): boolean {
        const readPtr = this.getInstanceReadPointer();
        if (readPtr === null) {
            throw new Error("No instance read pointer provided for this RingSAB");
        }
        const writePtr = this.getWritePointer();
        const isFull = this.isFull();
        if (readPtr === writePtr && !isFull) return false;
        let available = (writePtr - readPtr + this.#sab.length) % this.#sab.length;
        if (readPtr === writePtr) { available = this.#sab.length; }
        const actualNumbersToWrite = Math.min(numbersToWrite, available);
        if (actualNumbersToWrite === 0) {
            return false;
        }
        const firstPart = Math.min(this.#sab.length - readPtr, actualNumbersToWrite);
        const secondPart = actualNumbersToWrite - firstPart;
        readerToWriteTo.set(this.#sab.subarray(readPtr, readPtr + firstPart), offset);
        readerToWriteTo.set(this.#sab.subarray(0, secondPart), offset + firstPart);
        const newReadPtr = (readPtr + actualNumbersToWrite) % this.#sab.length;
        if (actualNumbersToWrite > 0) {
            this.storeIsFull(false);
        }
        this.storeInstanceReadPointer(newReadPtr);
        return true;
    }

    readMultiTrack(reader: TypedArray, trackCount: number, framesPerTrack: number): boolean {
        const readPtr = this.getInstanceReadPointer();
        if (readPtr === null) {
            throw new Error("No instance read pointer provided for this RingSAB");
        }
        const writePtr = this.getWritePointer();
        if (readPtr === writePtr && !this.isFull()) return false;
        const trackBufferLen = Math.floor(this.#sab.length / trackCount);
        let available = (writePtr - readPtr + trackBufferLen) % trackBufferLen;
        if (readPtr === writePtr) { available = trackBufferLen; }
        const readLength = Math.min(available, framesPerTrack);
        for (let track = 0; track < trackCount; track++) {
            const first = Math.min(trackBufferLen - readPtr, readLength);
            const second = readLength - first;
            const bufferStart = track * trackBufferLen;
            const readerStart = track * framesPerTrack;
            reader.set(this.#sab.subarray(bufferStart + readPtr, bufferStart + readPtr + first), readerStart);
            reader.set(this.#sab.subarray(bufferStart, bufferStart + second), readerStart + first);
        }
        const newReadPtr = (readPtr + readLength) % trackBufferLen;
        if (readLength > 0) {
            this.storeIsFull(false);
        }
        this.storeInstanceReadPointer(newReadPtr);
        return true;
    }

    write(dataToWrite: TypedArray, offset: number, numbersToWrite: number): void {
        const writePtr = this.getWritePointer();
        const readPtrs = this.getAllReadPointers();
        const f = (readPtr: number) => (readPtr - writePtr + this.#sab.length) % this.#sab.length;
        let minSpace = this.#sab.length;
        for (let i = 0; i < readPtrs.length; i++) {
            if(readPtrs[i] === writePtr && !this.isFull()) {
                continue;
            } else {
                minSpace = Math.min(minSpace, f(readPtrs[i]));
            }
        }
        const isFull = this.isFull();
        if (isFull) {
            throw new Error(`RingSAB is full. Cannot write.`);
        }
        const availableSpace = readPtrs.length > 0 ? minSpace : this.#sab.length;
        const actualNumbersToWrite = Math.min(numbersToWrite, availableSpace);
        if (actualNumbersToWrite < numbersToWrite) {
            throw new Error(`Not enough space in RingSAB to write data. Available space: ${availableSpace}, numbers to write: ${numbersToWrite}`);
        }
        const firstPart = Math.min(this.#sab.length - writePtr, actualNumbersToWrite);
        const secondPart = actualNumbersToWrite - firstPart;
        this.#sab.set(dataToWrite.subarray(offset, offset + firstPart), writePtr);
        this.#sab.set(dataToWrite.subarray(offset + firstPart, offset + firstPart + secondPart), 0);
        const newWritePtr = (writePtr + actualNumbersToWrite) % this.#sab.length;
        this.storeWritePointer(newWritePtr);
        // Check if buffer is now full (write caught up to any read pointer)
        const updatedReadPtrs = this.getAllReadPointers();
        for (const ptr of updatedReadPtrs) {
            if (newWritePtr === ptr) {
                this.storeIsFull(true);
                break;
            }
        }
    }

    isFull(): boolean {
        return Atomics.load(this.#pointers.isFull, 0) === 1;
    }

    getAllReadPointers(): number[] {
        return this.#pointers.read.map(ptr => Atomics.load(ptr, 0));
    }

    getInstanceReadPointer(): number | null {
        if (this.#instanceReadPtr !== null) {
            return Atomics.load(this.#instanceReadPtr, 0);
        } else {
            console.error("No instance read pointer provided for this RingSAB");
            return null;
        }
    }

    getWritePointer(): number {
        return Atomics.load(this.#pointers.write, 0);
    }

    storeInstanceReadPointer(ptr: number): void {
        if (this.#instanceReadPtr !== null) {
            Atomics.store(this.#instanceReadPtr, 0, ptr);
        } else {
            console.error("No instance read pointer provided for this RingSAB");
        }
    }

    storeWritePointer(ptr: number): void {
        Atomics.store(this.#pointers.write, 0, ptr);
    }

    storeIsFull(isFull: boolean): void {
        Atomics.store(this.#pointers.isFull, 0, isFull ? 1 : 0);
    }

    resetPointers(){
        this.storeWritePointer(0);
        this.#pointers.read.forEach(ptr => Atomics.store(ptr, 0, 0));
        this.storeIsFull(false);
    }
}