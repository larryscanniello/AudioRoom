class RecorderProcessor extends AudioWorkletProcessor {
  constructor(playbackSAB) {
    super();

    this.isRecording = false;
    this.isPlayingBack = true;
    this.recordingBuffer = null;
    this.playbackPos = 0;
    this.packetSize = 960;
    this.firstPacket = true;
    this.emptyPacket = false;
    this.sessionId = null;
    this.latencyFrames = 0;
    this.startTime = 0;
    this.recordingCount = 0;
    this.packetPos = 0;
    this.packetCount = 0;
    this.lookaheadSamples = Math.round(.05*sampleRate);
    this.samplesSinceRecordButtonPressed = 0;
    this.playbackBuffer = new Float32Array(this.playbackSAB,8);
    this.readerOutput = new Float32Array(256);
    this.playbackReadPointer = new Uint32Array(this.playbackSAB,0,1);
    this.playbackWritePointer = new Uint32Array(this.playbackSAB,4,1);
    this.lastBufferFillTime = currentTime;
    this.timelineStart = 0;

    this.port.onmessage = (e) => {
      if (e.data.actiontype === 'start'){ 
        this.sessionId = e.data.sessionId;
        this.recordingBuffer = new Float32Array(this.packetSize);
        this.isRecording = true;
        this.playbackBuffer = e.data.buffer
        this.latencyFrames = e.data.delayCompensation[0]
        this.playbackPos = this.latencyFrames-this.lookaheadSamples; //compensate for metronome delay
        this.firstPacket = true;
        this.startTime = e.data.startTime ?? 0;
        this.recordingNumber = e.data.recordingCount
        this.packetCount = 0;
        this.recordingCount = e.data.recordingCount;
        this.packetPos = 0;
        this.samplesSinceRecordButtonPressed = 0;
        this.timelineStart = e.data.timelineStart;
      };
      if (e.data.actiontype === 'stop'){ 
        if (e.data.sessionId !== this.sessionId || this.sessionId === null) return;
        this.isRecording = false;
        this.playbackPos = 0;
        if(e.data.keepRecording && (this.recordingBuffer.length > 0 || this.emptyPacket)){
          this.port.postMessage({
            type:"packet",
            packet:this.recordingBuffer,
            first:this.firstPacket,
            last:true,
            playbackPos:this.playbackPos-this.latencyFrames,
            recordingCount:this.recordingCount,
            packetCount:this.packetCount++,
            timelineStart:this.timelineStart;
          });
        }
        this.sessionId = null;
      };
    };

    

  }

  readTo(arrayToCopyInto){
      const { readPos, available } = this.getReadInfo()
      if (available === 0) {
        return 0
      }
      if(available / this.playbackBuffer.length <= 0.9 && currentTime - this.lastBufferFillTime >= 0.1){
        this.port.postMessage({type:"fill_playback_buffer"});
        this.lastBufferFillTime = currentTime;
      }

      const readLength = Math.min(available, arrayToCopyInto.length)

      const first = Math.min(this.playbackBuffer.length - readPos, readLength)
      const second = readLength - first

      this.copy(this.playbackBuffer, readPos, arrayToCopyInto, 0, first)
      this.copy(this.playbackBuffer, 0, arrayToCopyInto, first, second)

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
      const available = (writePos - readPos +this.playbackBuffer.length) % this.playbackBuffer.length
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

  process(inputs,outputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    if(this.isRecording){
      if(this.samplesSinceRecordButtonPressed < this.lookaheadSamples - 128){
        this.samplesSinceRecordButtonPressed += 128;
      }else{
        let k = 0;
        if(this.samplesSinceRecordButtonPressed < this.lookaheadSamples){
          k = this.lookaheadSamples - this.samplesSinceRecordButtonPressed;
          this.samplesSinceRecordButtonPressed = this.lookaheadSamples;
        }
        for(let j=k;j<128;j++){
          if(this.packetPos>=this.packetSize && this.isRecording){
            this.port.postMessage({packet:this.recordingBuffer,
                                    type:"packet",
                                    first:this.firstPacket,
                                    last:false,
                                    playbackPos:this.playbackPos-this.latencyFrames,
                                    recordingCount:this.recordingCount,
                                    packetCount:this.packetCount++,
                                  });
            this.firstPacket = false;
            this.emptyPacket = true;
            this.packetPos = 0;
          }
          this.recordingBuffer[this.packetPos] = input[0][j];
          this.packetPos++;
        }
      }
      
      this.readTo(this.readerOutput);
      
      for (let i = 0; i < this.readerOutput.length; i++) {
        for (let channel = 0; channel < 2; channel++) {
          outputs[channel][i] = this.readerOutput[2 * i + channel];
        }
      }
      
    }

    return true;
  }
}







registerProcessor("RecorderProcessor", RecorderProcessor);
