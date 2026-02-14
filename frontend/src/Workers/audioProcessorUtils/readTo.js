
const PROCESS_FRAMES = 128;

export function readTo(reader,pointers,buffer,TRACK_COUNT){
      let readPtr = Atomics.load(pointers.read, 0);
      const writePos = Atomics.load(pointers.write, 0);
      const isFull = Atomics.load(pointers.isFull,0);
      if(readPtr===writePos && !isFull) return false;
      const trackBufferLen = buffer.length/TRACK_COUNT;
      const trackReaderLen = reader.length/TRACK_COUNT;
      let available = (writePos - readPtr + trackBufferLen) % trackBufferLen;
      if(readPtr === writePos){available = trackBufferLen;}
      const readLength = Math.min(available, trackReaderLen);
      for(let track=0;track<TRACK_COUNT;track++){
        const first = Math.min(trackBufferLen - readPtr, readLength);
        const second = readLength - first;
        const bufferStart = track * trackBufferLen;
        const readerStart = track * PROCESS_FRAMES;
        reader.set(buffer.subarray(bufferStart + readPtr,bufferStart + readPtr + first),readerStart);
        reader.set(buffer.subarray(bufferStart,bufferStart+second),readerStart + first);
      }
      readPtr = (readPtr + readLength) % trackBufferLen;
      if(readLength>0){
        Atomics.store(pointers.isFull,0,0);
      };
      Atomics.store(pointers.read,0,readPtr);
      return true;
    }