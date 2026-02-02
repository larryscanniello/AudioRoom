import {readTo} from "./audioProcessorUtils/readTo.js"

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.packetSize = 960;
    this.halfSecondInSamples = Math.round(0.5 * sampleRate);
    this.fiftymsInSamples = Math.round(.05 * sampleRate);
    this.maxTimelineSample = Math.round(60 * sampleRate);
    this.PROCESS_FRAMES = 128;

    this.buffers = {};

    this.readers = {
      staging: null,
      mix: null,
      record :null,
    }

    this.state = {
      isRecording: false,
      isPlayback: false,
      isStreaming: false,
      looping: false,
      sessionId:null,
      packetCount: 0,
      count:{
        bounce:0,
        take:-1,
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
    if(data.type === 'init'){
      Object.assign(this.buffers,e.data.buffers)
      Object.assign(this.pointers,e.data.pointers)
      Object.assign(this.readers,{
        staging: new Float32Array(this.PROCESS_FRAMES),
        mix: new Float32Array(this.PROCESS_FRAMES * this.buffers.mix.trackCount),
        record: new Float32Array(this.packetSize)
      });
    }
    if (data.type === 'start'){ 
      Object.assign(this.state, data.state);
      Object.assign(this.timeline,{
        start: Math.round(sampleRate * data.timeline.start),
        end: Math.round(sampleRate * data.timeline.end),
        pos: Math.round(sampleRate * data.timeline.pos),
      });
      const absStart = Math.round((currentTime + .05) * sampleRate);
      Object.assign(this.absolute,{
        start: absStart,
        end: this.timeline.end && !looping ? absStart + this.timeline.end - this.timeline.start : null,
        packetPos: 0,
      });
    };
    if (data.type === 'stop'){ 
      this.absolute.end = currentTime + .5;
      this.state.sessionId = null;
      if(this.state.isRecording){
        this.port.postMessage({
          timelineStart: this.timeline.start,
          timelineEnd: this.timeline.start + ((data.timelineEnd*sampleRate) - this.absolute.start),
          takeNumber: this.state.count.take,
          bounceNumber: this.state.count.bounce,
          fileName: `bounce_${this.state.count.bounce}_take_${this.state.count.take}`,
          fileLength: this.absolute.end + this.halfSecondInSamples - this.absolute.start,
        })
      }
      this.state.isPlayback = false;
      this.state.isRecording = false;
    };
    if(data.actiontype === "bounce_to_mix"){
      this.state.count.bounce += 1;
      this.state.count.take = -1;
    }
  }


  writeToRingBuffer() {
    let samplesWritten = 0;
    let sabWritePtr = Atomics.load(this.pointers.record.write,0);
    const readerReadPtr = 0;
    const samplesToFill = this.readers.record.length;
    while (samplesWritten < samplesToFill) {
        const remainingInPhysicalBuffer = this.readers.record.length - readerReadPtr;
        const chunkLength = Math.min(samplesToFill - samplesWritten, remainingInPhysicalBuffer,this.buffers.record.buffer.length - sabWritePtr);
        const readerSubarray = this.readers.record.subarray(readerReadPtr,readerReadPtr+chunkLength);
        this.buffers.record.buffer.set(readerSubarray,sabWritePtr);
        sabWritePtr = (sabWritePtr + chunkLength) % this.buffers.record.buffer.length;
        samplesWritten += chunkLength;
    }
    Atomics.store(this.pointers.record.write,0,sabWritePtr);
    if(sabWritePtr === Atomics.load(this.pointers.record.read,0)){
      Atomics.store(this.pointers.record.isFull,1);
    }
}

  process(inputs,outputs) {
    
    if(!this.state.isRecording && !this.state.isPlayback) return true;
    if(currentFrame+this.PROCESS_FRAMES<this.absolute.start) return true;
    //if not looping and at timeline end, stop playback
    if(this.absolute.end){
      if(currentFrame > this.absolute.end){this.state.isPlayback = false;}
      if(currentFrame > this.absolute.end + this.halfSecondInSamples){this.state.isRecording = false;}
    }
    const framesToDelay = 0//Math.max(0,this.absolute.start-currentFrame);
    const input = inputs[0];
    if (!input || !input[0]) return true;
    //take samples from the input stream and write them in the ring buffer; recording is mono
    for(let j=framesToDelay;j<this.PROCESS_FRAMES;j++){
      if(!this.state.isRecording) break;
      if(this.absolute.packetPos>=this.packetSize){
        this.writeToRingBuffer()
        this.absolute.packetPos = 0;
      }
      this.readers.record[this.absolute.packetPos] = input[0][j];
      this.absolute.packetPos++;
    }
    
    if(this.state.isPlayback) readTo(this.readers.staging,this.pointers.staging,this.buffers.staging.buffer,this.buffers.staging.trackCount);
    readTo(this.readers.mix,this.pointers.mix,this.buffers.mix.buffer,this.buffers.mix.trackCount);
    
    const output = outputs[0];
    for (let i = 0; i < this.PROCESS_FRAMES; i++) {
      if(!this.state.isRecording && !this.state.isPlayback) break;
        for (let channel = 0; channel < 2; channel++) {

          output[channel][i] = (this.state.isPlayback ? this.readers.staging[i] : 0);
          for(let track=0;track<this.buffers.mix.trackCount;track++){
            output[channel][i] += this.readers.mix[track * this.PROCESS_FRAMES + i];
          }
          
        }
    }
    return true;
  }
}

registerProcessor("AudioProcessor", AudioProcessor);
