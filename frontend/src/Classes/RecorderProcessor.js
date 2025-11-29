class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.buffer = [];
    this.port.onmessage = (e) => {
      const { actiontype } = e.data;
      if (actiontype === 'start'){ 
        this.buffer = [];
        this.isRecording = true;
      };
      if (actiontype === 'stop'){ 
        this.isRecording = false;
        this.port.postMessage({buffer:this.buffer});
      };
    };
  }
  process(inputs) {
    const input = inputs[0];

    if (!input || !input[0]) return true;

    if(this.isRecording){
      this.buffer.push(new Float32Array(input[0]));
    }

    return true;
  }
}

registerProcessor("RecorderProcessor", RecorderProcessor);
