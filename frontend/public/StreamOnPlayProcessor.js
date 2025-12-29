class StreamOnPlayProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.packetSize = 960;
    this.isStreaming = false;
    this.isPlayingBack = true;
    this.recordingBuffer = new Float32Array(this.packetSize);
    this.playbackBuffer1 = new Float32Array(0);
    this.playbackBuffer2 = new Float32Array(0);
    this.clickBuffer = null;
    this.gain1 = 1.0;
    this.gain2 = 1.0;
    this.playbackPos = 0;
    this.packetPos = 0;
    this.firstPacket = true;
    this.sessionId = null;
    this.latencyFrames = 0;
    this.looping = false;
    this.BPM = 120;
    this.metronomeOn = true;
    this.nextClickBeat = 0;
    this.isClicking = false;
    this.clickOffset = 0;
    this.cycles = 0;
    this.startTime = 0;

    this.port.onmessage = (e) => {
      if (e.data.actiontype === 'start'){ 
        this.sessionId = e.data.sessionId;
        this.looping = e.data.looping;
        this.recordingBuffer.fill(0);
        this.isStreaming = true;
        this.playbackBuffer1 = e.data.buffer1 ?? new Float32Array(0);
        this.playbackBuffer2 = e.data.buffer2 ?? new Float32Array(0);
        this.latencyFrames = e.data.delayCompensation[0]
        this.playbackPos = this.latencyFrames-(Math.floor(.05*sampleRate)); //compensate for metronome delay
        this.packetPos = 0;
        this.firstPacket = true;
        this.clickBuffer = e.data.clickBuffer;
        this.samplesPerBeat = sampleRate * 60 / e.data.BPM;
        this.metronomeOn = e.data.metronomeOn;
        this.nextClickBeat = 0;
        this.isClicking = false;
        this.clickOffset = 0;
        this.cycles = 0;
        this.startTime = e.data.startTime 
      };
      if (e.data.actiontype === 'stop'){ 
        if (e.data.sessionId !== this.sessionId || this.sessionId === null) return;
        this.isStreaming = false;
        this.sessionId = null;
      };
      if (e.data.actiontype === 'metronome'){
        this.metronomeOn = e.data.metronomeOn;
        this.BPM = e.data.BPM;
      }
      if (e.data.actiontype === 'gain1'){
        this.gain1 = e.data.gain;
      }
      if (e.data.actiontype === 'gain2'){
        this.gain2 = e.data.gain;
      }
    };
  }
  process(inputs,outputs) {

    const input = inputs[0];
    if (!input || !input[0]) return true;
    if(this.isStreaming){
      for(let j=0;j<128;j++){
        this.recordingBuffer[this.packetPos] = input[0][j]
        this.packetPos++;
        if(this.packetPos >= this.packetSize){
          this.port.postMessage({packet:this.recordingBuffer,
                                first:this.firstPacket,
                                last:false,
                                playbackPos:this.playbackPos-this.latencyFrames});
          this.packetPos = 0;
          this.recordingBuffer.fill(0);
        }
      }
      //handle output for the person who's being listened to
      if(this.playbackBuffer1 && this.playbackPos<this.playbackBuffer1.length || this.playbackBuffer2 && this.playbackPos < this.playbackBuffer2.length){
        const output = outputs[0];
        const outL = output[0];
        const outR = output[1] ?? output[0];
        for(let i=0;i<128;i++){
          if(this.isPlayingBack && this.playbackPos>=0){
            outL[i] = this.playbackBuffer1[this.playbackPos] * this.gain1 ?? 0;
            outR[i] = this.playbackBuffer1[this.playbackPos] * this.gain1 ?? 0;
            outL[i] += this.playbackBuffer2[this.playbackPos] * this.gain2 ?? 0;
            outR[i] += this.playbackBuffer2[this.playbackPos] * this.gain2 ?? 0;
            let targetSample = this.nextClickBeat * this.samplesPerBeat;
            if(this.playbackPos + (this.cycles * this.playbackBuffer1.length) >= targetSample){
                this.clickOffset = 0;
                this.isClicking = true;
                this.nextClickBeat++;
            }
            if(this.isClicking){
                if(this.metronomeOn){
                    outL[i] += this.clickBuffer[this.clickOffset];
                    outR[i] += this.clickBuffer[this.clickOffset];
                }
                this.clickOffset++;
                if(this.clickOffset >= this.clickBuffer.length){
                    this.isClicking = false;
                }
            }
          }
          if(this.looping){
            if(this.playbackPos + 1 >= this.playbackBuffer1.length){
                this.playbackPos = 0
                this.cycles++;
            }else{
                this.playbackPos++;
            }
          }else{
            this.playbackPos++;
            if(this.playbackPos>=this.playbackBuffer1.length){
                this.isStreaming = false;
                this.playbackPos = 0;
                this.recordingBuffer = new Float32Array(0);
                this.sessionId = null;
            }
          }
        }
      }
    }

    return true;
  }
}

registerProcessor("StreamOnPlayProcessor", StreamOnPlayProcessor);
