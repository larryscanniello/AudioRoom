
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
    #instanceReadPtr: IntegerTypedArray|null;

    constructor(sab: TypedArray, pointers: PointerArgs,readPtr?: IntegerTypedArray){
        this.#sab = sab;
        this.#pointers = {
            read: [pointers.read],
            write: pointers.write,
            isFull: pointers.isFull,
        }
        if(pointers.read2){
            this.#pointers.read.push(pointers.read2);
        }
        this.#instanceReadPtr = readPtr || null;
    }

    getBuffer(): TypedArray {
        return this.#sab;
    }

    availableSamples(): number {
        const isFull = this.isFull();
        if(isFull){
            return this.#sab.length;
        }
        const readPtrs = this.getAllReadPointers();
        const writePtr = this.getWritePointer();
        let availableSamples = this.#sab.length;
        readPtrs.forEach((readPtr: number) => {
            availableSamples = Math.min(availableSamples, (writePtr - readPtr + this.#sab.length) % this.#sab.length);
        });
        return availableSamples;
    }

    read(readerToWriteTo: TypedArray, offset: number, numbersToWrite: number) {
        const readPtr = this.getInstanceReadPointer();
        if(readPtr === null){
            throw new Error("No instance read pointer provided for this RingSAB");
        }
        const writePtr = this.getWritePointer();
        const actualNumbersToWrite = Math.min(numbersToWrite, (writePtr - readPtr + this.#sab.length) % this.#sab.length);
        if(actualNumbersToWrite===0){
            return;
        }
        const firstPart = Math.min(this.#sab.length - readPtr, actualNumbersToWrite);
        const secondPart = actualNumbersToWrite - firstPart;
        readerToWriteTo.set(this.#sab.subarray(readPtr,readPtr + firstPart), offset);
        readerToWriteTo.set(this.#sab.subarray(0,secondPart), offset + firstPart);
        this.storeReadPointer((readPtr + actualNumbersToWrite) % this.#sab.length);

    }

    write(dataToWrite: TypedArray, offset: number, numbersToWrite: number) {
        const writePtr = this.getWritePointer();
        const readPtrs = this.getAllReadPointers();
        const fx = (readPtr: number) => (writePtr - readPtr + this.#sab.length) % this.#sab.length;
        let minReadPtr = readPtrs[0];
        for(let i=1;i<readPtrs.length;i++){
            if(fx(readPtrs[i])<fx(minReadPtr)){
                minReadPtr = readPtrs[i];
            }
        }
        const availableSpace = (minReadPtr - writePtr + this.#sab.length) % this.#sab.length;
        const actualNumbersToWrite = Math.min(numbersToWrite, availableSpace);
        if(actualNumbersToWrite < numbersToWrite){
            throw new Error(`Not enough space in RingSAB to write data. Available space: ${availableSpace}, numbers to write: ${numbersToWrite}`);
        }
        const firstPart = Math.min(this.#sab.length - writePtr, actualNumbersToWrite);
        const secondPart = actualNumbersToWrite - firstPart;
        this.#sab.set(dataToWrite.subarray(offset, offset + firstPart), writePtr);
        this.#sab.set(dataToWrite.subarray(offset + firstPart, offset + firstPart + secondPart), 0);
        this.storeWritePointer((writePtr + actualNumbersToWrite) % this.#sab.length);
    }

    isFull(): boolean {
        return Atomics.load(this.#pointers.isFull, 0) === 1;
    }

    getAllReadPointers(): number[] {
        return this.#pointers.read.map(ptr => Atomics.load(ptr, 0));
    }

    getInstanceReadPointer(): number | null {
        if(this.#instanceReadPtr){
            return Atomics.load(this.#instanceReadPtr, 0);
        }else{
            console.error("No instance read pointer provided for this RingSAB");
            return null;
        }
    }

    getWritePointer(): number {
        return Atomics.load(this.#pointers.write, 0);
    }

    storeReadPointer(ptr:number){
        if(this.#instanceReadPtr){
            Atomics.store(this.#instanceReadPtr, 0, ptr);
        }else{
            console.error("No instance read pointer provided for this RingSAB");
        }
    }

    storeWritePointer(ptr:number){
        Atomics.store(this.#pointers.write, 0, ptr);
    }

    storeIsFull(isFull: boolean){
        Atomics.store(this.#pointers.isFull, 0, isFull ? 1 : 0);
    }
}