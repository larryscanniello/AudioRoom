const PROCESS_FRAMES = 128;

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.packetSize = 960;
    this.halfSecondInSamples = Math.round(0.5 * sampleRate);
    this.fiftymsInSamples = Math.round(.05 * sampleRate);
    this.maxTimelineSample = Math.round(60 * sampleRate);

    this.buffers = {
      staging: new Float32Array(options.processorOptions.stagingSAB,9),
      mix: new Float32Array(options.processorOptions.mixSAB,9),
      record: new Float32Array(options.processorOptions.recordSAB,9),
    }

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
      recordingCount: 0,
    }

    this.timeline = {
      start: null,
      end: null,
      pos: null,
    }

    this.absolute = {
      start: null,
      end: null,
      packetPos: 0,
    }

    this.pointers = {
      staging: {
        read: new Uint32Array(options.processorOptions.stagingSAB,0),
        write: new Uint32Array(options.processorOptions.stagingSAB,4),
        isFull: new Uint8Array(options.processorOptions.stagingSAB,8),
      },
      mix: {
        read: new Uint32Array(options.processorOptions.mixSAB,0),
        write: new Uint32Array(options.processorOptions.mixSAB,4),
        isFull: new Uint8Array(options.processorOptions.mixSAB,8),
      },
      record: {
        read: new Uint32Array(options.processorOptions.recordSAB,0),
        write: new Uint32Array(options.processorOptions.recordSAB,4),
        isFull: new Uint8Array(options.processorOptions.recordSAB,8),
      }
    }
    this.port.onmessage = (e) => handleMessage(e.data);
  }

  handleMessage(data){
    if (data.actiontype === 'start'){ 
      Object.assign(this.state, {
        sessionId: data.sessionId,
        isRecording: data.isRecording,
        isPlaying: !data.isRecording,
        isStreaming: data.isStreaming,
        looping: data.looping,
        packetCount: 0,
        recordingCount: data.recordingCount,
      });
      Object.assign(this.timeline,{
        start: Math.round(data.timelineStart * sampleRate),
        end: data.timelineEnd ? Math.round(data.timelineEnd * sampleRate) : this.maxTimelineSample,
        pos: Math.round(data.timelineStart * sampleRate),
      });
      Object.assign(this.absolute,{
        start:Math.round(sampleRate * data.startTime),
        end: data.looping ? null :
          data.endTime ? Math.round(sampleRate * data.endTime) : this.maxTimelineSample,
        packetPos: 0,
      }
      )
    };
    if (data.actiontype === 'stop'){ 
      if (data.sessionId !== this.sessionId || this.sessionId === null) return;
      this.state.isPlayback = false;
      this.absolute.end = Math.round(data.endTime * sampleRate); //record an extra half seconds for crossfades
      this.sessionId = null;
    };
  }

  readTo(arrayToCopyInto,type){
      const { readPos, available } = this.getReadInfo()
      if (available === 0) {
        return 0
      }

      /*
      if(available / this.playbackBuffer.length <= 0.9 && currentTime - this.lastBufferFillTime >= 0.1){
        this.port.postMessage({type:"fill_playback_buffer"});
        this.lastBufferFillTime = currentTime;
      }*/
      const playbackBuffer = type==="mix"?this.buffers.mix:this.buffers.staging;
      const readLength = Math.min(available, arrayToCopyInto.length)
      const bufferLength = playbackBuffer.length;
      const first = Math.min(bufferLength - readPos, readLength);
      const second = readLength - first;

      this.copy(playbackBuffer, readPos, arrayToCopyInto, 0, first)
      this.copy(playbackBuffer, 0, arrayToCopyInto, first, second)

      Atomics.store(
        this.playbackReadPointer,
        0,
        (readPos + readLength) % this.storage.length,
      )

      return readLength
    }

  getReadInfo() {
      const readPos = Atomics.load(this.playbackReadPointer, 0)
      const writePos = Atomics.load(this.playbackWritePointer, 0)
      const available = (writePos - readPos + this.playbackBuffer.length) % this.playbackBuffer.length
      return {
        readPos,
        writePos,
        available,
      }
    }

  copy(input,offset_input,output,offset_output,size){
    for (let i = 0; i < size; i++) {
      output[offset_output + i] = input[offset_input + i]
    }
  }

  writeToRingBuffer(samplesToFill, sabToWriteTo, writePtr) {
    let samplesWritten = 0;
    while (samplesWritten < samplesToFill) {
        const currentPtr = Atomics.load(stagingPlaybackWritePtr, 0);
        const remainingInPhysicalBuffer = PLAYBACK_BUFFER_SIZE - currentPtr;
        const chunkLength = Math.min(totalSamples - samplesWritten, remainingInPhysicalBuffer);
        const chunkView = sabView.subarray(currentPtr, currentPtr + chunkLength);
        
        const nextPtr = (currentPtr + chunkLength) % PLAYBACK_BUFFER_SIZE;
        Atomics.store(writePtr, 0, nextPtr);
        samplesWritten += chunkLength;
    }
}

  process(inputs,outputs) {
    if(!this.state.isRecording && !this.state.isPlayback) return;
    if(currentFrame+PROCESS_FRAMES<this.absolute.start){ return;}
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
    }
    const framesToDelay = Math.max(0,this.absolute.start-currentFrame);
    const input = inputs[0];
    if (!input || !input[0]) return true;
    //take samples from the input stream and write them in the ring buffer; recording is mono
    for(let j=framesToDelay;j<128;j++){
      if(!this.state.isRecording) break;
      if(this.absolute.packetPos>=this.packetSize){
        this.writeToRingBuffer(this.packetSize,this.buffers.record,this.pointers.record.write)
        this.absolute.packetPos = 0;
      }
      this.readers.record[this.absolute.packetPos] = input[0][j];
      this.absolute.packetPos++;
    }
    
    if(this.state.isPlayback) this.readTo(this.readers.staging,"staging");
    this.readTo(this.readers.mix,"mix");
    
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
