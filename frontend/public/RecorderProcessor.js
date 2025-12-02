class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isRecording = false;
    this.isPlayingBack = true;
    this.recordingBuffer = [];
    this.playbackBuffer = null;
    this.playbackPos = 0;

    this.port.onmessage = (e) => {
      if (e.data.actiontype === 'start'){ 
        this.recordingBuffer = [];
        this.isRecording = true;
        this.playbackBuffer = e.data.buffer
        this.playbackPos = e.data.delayCompensation[0]-(Math.floor(.05*sampleRate)); //compensate for metronome delay
      };
      if (e.data.actiontype === 'stop'){ 
        this.isRecording = false;
        this.playbackPos = 0;
        this.port.postMessage({buffer:this.recordingBuffer});
        this.recordingBuffer = [];
      };
    };
  }
  process(inputs,outputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    if(this.isRecording){
      this.recordingBuffer.push(new Float32Array(input[0]));
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
