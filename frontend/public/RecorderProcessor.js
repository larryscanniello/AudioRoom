class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isRecording = false;
    this.isPlayingBack = true;
    this.recordingBuffer = null;
    this.playbackBuffer = null;
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
        console.log(currentTime);
      };
      if (e.data.actiontype === 'stop'){ 
        if (e.data.sessionId !== this.sessionId || this.sessionId === null) return;
        this.isRecording = false;
        this.playbackPos = 0;
        if(e.data.keepRecording && (this.recordingBuffer.length > 0 || this.emptyPacket)){
          this.port.postMessage({
            packet:this.recordingBuffer,
            first:this.firstPacket,
            last:true,
            playbackPos:this.playbackPos-this.latencyFrames,
            recordingCount:this.recordingCount,
            packetCount:this.packetCount++,
          });
        }
        this.sessionId = null;
      };
    };
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
          console.log(currentTime,k);
        }
        for(let j=k;j<128;j++){
          if(this.packetPos>=this.packetSize && this.isRecording){
            this.port.postMessage({packet:this.recordingBuffer,
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
      
      
      if(this.playbackPos<this.playbackBuffer.length){
        const output = outputs[0];
        const outL = output[0];
        const outR = output[1] ?? output[0];
        for(let i=0;i<128;i++){
          if(this.isPlayingBack && this.playbackPos>=0){
            outL[i] = this.playbackBuffer[this.playbackPos] ?? 0;
            outR[i] = this.playbackBuffer[this.playbackPos] ?? 0;
          }
          this.playbackPos++;
        }
      }
    }

    return true;
  }
}







registerProcessor("RecorderProcessor", RecorderProcessor);
