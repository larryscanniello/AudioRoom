class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isRecording = false;
    this.isPlayingBack = true;
    this.recordingBuffer = new Float32Array(0);
    this.playbackBuffer = null;
    this.playbackPos = 0;
    this.packetSize = 4096;
    this.firstPacket = true;
    this.emptyPacket = false;
    this.sessionId = null;
    this.latencyFrames = 0;
    this.startTime = 0;

    this.port.onmessage = (e) => {
      if (e.data.actiontype === 'start'){ 
        this.sessionId = e.data.sessionId;
        this.recordingBuffer = [];
        this.isRecording = true;
        this.playbackBuffer = e.data.buffer
        this.latencyFrames = e.data.delayCompensation[0]
        this.playbackPos = this.latencyFrames-(Math.floor(.05*sampleRate)); //compensate for metronome delay
        this.firstPacket = true;
        this.startTime = e.data.startTime ?? 0;
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
            playbackPos:this.playbackPos-this.latencyFrames});
        }
        this.recordingBuffer = [];
        this.sessionId = null;
      };
    };
  }
  process(inputs,outputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    if(this.isRecording && currentTime >= this.startTime){
      //do all this nonsense to keep the recordingbuffer a float 32 array
      const existingBuffer = this.recordingBuffer;
      const newInput = new Float32Array(input[0]);
      const newLength = existingBuffer.length + newInput.length;
      const newBuffer = new Float32Array(newLength);
      newBuffer.set(existingBuffer, 0);
      newBuffer.set(newInput, existingBuffer.length);
      this.recordingBuffer = newBuffer;
      this.emptyPacket = false;
      if(this.recordingBuffer.length==this.packetSize){
        this.port.postMessage({packet:this.recordingBuffer,
                                first:this.firstPacket,
                                last:false,
                                playbackPos:this.playbackPos-this.latencyFrames});
        this.recordingBuffer = new Float32Array(0);
        this.firstPacket = false;
        this.emptyPacket = true;
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
