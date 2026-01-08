const PROCESS_FRAMES = 128;

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.packetSize = 960;
    this.halfSecondInSamples = Math.round(0.5 * sampleRate);
    this.fiftymsInSamples = Math.round(.05 * sampleRate);
    this.maxTimelineSample = Math.round(60 * sampleRate);

    this.buffers = {};

    this.readers = {
      staging: new Float32Array(PROCESS_FRAMES),
      mix: new Float32Array(PROCESS_FRAMES * 2),
      record: new Float32Array(this.packetSize)
    }

    this.state = {
      isRecording: false,
      isPlayback: false,
      isStreaming: false,
      looping: false,
      sessionId:null,
      packetCount: 0,
      count:{
        track:0,
        take:0
      }
    }

    //in samples
    this.timeline = {
      start: null,
      end: null,
      pos: null,
    }

    //in samples
    this.absolute = {
      start: null,
      end: null,
      packetPos: 0,
    }

    this.pointers = {
      staging: {
        read: null,
        write: null,
        isFull: null,
      },
      mix: {
        read: null,
        write: null,
        isFull: null,
      },
      record: {
        read: null,
        write: null,
        isFull: null,
      }
    }
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(data){
    if(data.actiontype === 'init'){
      Object.assign(this.buffers,{
        staging: new Float32Array(data.stagingSAB,12),
        mix: new Float32Array(data.mixSAB,12),
        record: new Float32Array(data.recordSAB,12),
      })
      Object.assign(this.pointers,{
        staging: {
        read: new Uint32Array(data.stagingSAB,0),
        write: new Uint32Array(data.stagingSAB,4),
        isFull: new Uint32Array(data.stagingSAB,8),
      },
      mix: {
        read: new Uint32Array(data.mixSAB,0),
        write: new Uint32Array(data.mixSAB,4),
        isFull: new Uint32Array(data.mixSAB,8),
      },
      record: {
        read: new Uint32Array(data.recordSAB,0),
        write: new Uint32Array(data.recordSAB,4),
        isFull: new Uint32Array(data.recordSAB,8),
      }
      })
    }
    if (data.actiontype === 'start'){ 
      console.log('ap started');
      Object.assign(this.state, {
        sessionId: data.sessionId,
        isRecording: true,//data.isRecording,
        isPlaying: !data.isRecording,
        isStreaming: data.isStreaming,
        looping: data.looping,
        packetCount: 0,
        recordingCount: data.recordingCount,
      });
      Object.assign(this.timeline,{
        start: Math.round(data.timelineStart * sampleRate),
        end: null,
        pos: Math.round(data.timelineStart * sampleRate),
      });
      Object.assign(this.absolute,{
        start:Math.round(sampleRate * data.startTime),
        end: Math.round(sampleRate * data.endTime),
        packetPos: 0,
      }
      )
    };
    if (data.actiontype === 'stop'){ 
      if (data.sessionId !== this.state.sessionId || this.state.sessionId === null) return;
      console.log('ap stopped');
      this.state.isPlayback = false;
      this.state.isRecording = false;
      this.absolute.end = Math.round(data.endTime * sampleRate); //record an extra half seconds for crossfades
      this.state.sessionId = null;
      console.log('tl',this.timeline,'data.timelineEnd',data.timelineEnd,'abs',this.absolute)
      if(true || this.state.isRecording){
        this.port.postMessage({
          timelineStart: this.timeline.start,
          timelineEnd: this.timeline.start + ((data.timelineEnd*sampleRate) - this.absolute.start),
          takeNumber: this.state.count.take,
          fileName: `track_${this.state.count.track}_take_${this.state.count.take}`,
          fileLength: this.absolute.end + this.halfSecondInSamples - this.absolute.start,
        })
      }
    };
  }

  readTo(reader,type){
      const readPos = Atomics.load(this.pointers[type].read, 0);
      const writePos = Atomics.load(this.pointers[type].write, 0);
      const isFull = Atomics.load(this.pointers[type].isFull,0);
      if (isFull) {
        return 0
      }
      const available = (writePos - readPos + this.buffers[type].length) % this.buffers[type].length;
      const readLength = Math.min(available, reader.length)
      const bufferLength = this.buffers[type].length;
      const first = Math.min(bufferLength - readPos, readLength);
      const second = readLength - first;

      this.copy(playbackBuffer, readPos, reader, 0, first)
      this.copy(playbackBuffer, 0, reader, first, second)

      Atomics.store(
        this.pointers[type].read,
        0,
        (readPos + readLength) % this.storage.length,
      )
      Atomics.store(this.readers[type].isFull,0,0);

      return readLength
    }

  copy(input,offset_input,output,offset_output,size){
    for (let i = 0; i < size; i++) {
      output[offset_output + i] = input[offset_input + i]
    }
  }

  writeToRingBuffer() {
    let samplesWritten = 0;
    let sabWritePtr = Atomics.load(this.pointers.record.write,0);
    const readerReadPtr = 0;
    const samplesToFill = this.readers.record.length;
    while (samplesWritten < samplesToFill) {
        const remainingInPhysicalBuffer = this.readers.record.length - readerReadPtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer,this.buffers.record.length - sabWritePtr);
        const readerSubarray = this.readers.record.subarray(readerReadPtr,readerReadPtr+chunkLength);
        this.buffers.record.set(readerSubarray,sabWritePtr);
        
        sabWritePtr = (sabWritePtr + chunkLength) % this.buffers.record.length;
        samplesWritten += chunkLength;
    }
    Atomics.store(this.pointers.record.write,0,sabWritePtr);
    if(sabWritePtr === Atomics.load(this.pointers.record.read,0)){
      Atomics.store(this.pointers.record.isFull,1);
    }
}

  process(inputs,outputs) {
    if(!this.state.isRecording && !this.state.isPlayback) return true;
    /*
    if(currentFrame+PROCESS_FRAMES<this.absolute.start){ return true;}
    //if not looping and at timeline end, stop playback
    if(!this.looping && currentFrame - this.absolute.start > this.timeline.end - this.timeline.start){
      this.state.isPlayback = false;
    }
    if(!this.looping && currentFrame - this.absolute.start - (.5 * sampleRate) > this.timeline.end - this.timeline.start){
      this.state.isRecording = false;
    }
    if(this.absolute.end){
      if(currentFrame > this.absolute.end){this.state.isPlayback = false;}
      if(currentFrame > this.absolute.end + this.halfSecondInSamples){this.state.isRecording = false;}
    }*/
    const framesToDelay = 0//Math.max(0,this.absolute.start-currentFrame);
    const input = inputs[0];
    if (!input || !input[0]) return true;
    //take samples from the input stream and write them in the ring buffer; recording is mono
    for(let j=framesToDelay;j<PROCESS_FRAMES;j++){
      if(!this.state.isRecording) break;
      if(this.absolute.packetPos>=this.packetSize){
        this.writeToRingBuffer()
        this.absolute.packetPos = 0;
      }
      this.readers.record[this.absolute.packetPos] = input[0][j];
      this.absolute.packetPos++;
    }
    
    //if(this.state.isPlayback) this.readTo(this.readers.staging,"staging");
    //this.readTo(this.readers.mix,"mix");
    
    const output = outputs[0];

    for (let i = 0; i < PROCESS_FRAMES; i++) {
      if(!this.state.isRecording && !this.state.isPlayback) break;
        for (let channel = 0; channel < 2; channel++) {
          output[channel][i] = this.readers.mix[2 * i + channel] + (this.isPlayback ? this.readers.staging[i] : 0);
        }
    }

    return true;
  }
}







registerProcessor("AudioProcessor", AudioProcessor);
