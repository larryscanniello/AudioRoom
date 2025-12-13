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

    this.port.onmessage = (e) => {
      if (e.data.actiontype === 'start'){ 
        this.recordingBuffer = [];
        this.isRecording = true;
        this.playbackBuffer = e.data.buffer
        this.playbackPos = e.data.delayCompensation[0]-(Math.floor(.05*sampleRate)); //compensate for metronome delay
        this.firstPacket = true;
      };
      if (e.data.actiontype === 'stop'){ 
        this.isRecording = false;
        this.playbackPos = 0;
        if(e.data.keepRecording && this.recordingBuffer.length>0){
          this.port.postMessage({packet:this.recordingBuffer,first:this.firstPacket,last:true});
        }
        this.recordingBuffer = [];
      };
    };
  }
  process(inputs,outputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    if(this.isRecording){
      //do all this nonsense to keep the recordingbuffer a float 32 array
      const existingBuffer = this.recordingBuffer;
      const newInput = new Float32Array(input[0]);
      const newLength = existingBuffer.length + newInput.length;
      const newBuffer = new Float32Array(newLength);
      newBuffer.set(existingBuffer, 0);
      newBuffer.set(newInput, existingBuffer.length);
      this.recordingBuffer = newBuffer;
      if(this.recordingBuffer.length==this.packetSize){
        this.port.postMessage({packet:this.recordingBuffer,first:this.firstPacket,last:false});
        this.recordingBuffer = new Float32Array(0);
        this.firstPacket = false;
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
