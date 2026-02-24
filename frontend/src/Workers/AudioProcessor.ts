import { CONSTANTS } from "../Constants/constants.js";
import { RingSAB } from "../Core/RingSAB.js";
import type { Buffers, Pointers, AudioProcessorData } from "../Types/AudioState.js";

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: "a-rate" | "k-rate";
}

declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

declare function registerProcessor(
  name: string,
  processorCtor: (new (
    options?: AudioWorkletNodeOptions
  ) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  }
): void;

declare var sampleRate: number;
declare var currentTime: number;
declare var currentFrame: number;

interface ProcessorBuffers {
  staging: RingSAB | null;
  mix: RingSAB | null;
  record: RingSAB | null;
}

interface ProcessorReaders {
  staging: Float32Array | null;
  mix: Float32Array | null;
  record: Float32Array | null;
}

interface ProcessorState {
  isRecording: boolean;
  isPlaying: boolean;
  isStreaming: boolean;
  looping: boolean;
  packetCount: number;
  count: {
    bounce: number;
    take: number;
  };
}

interface Timeline {
  start: number | null;
  end: number | null;
  pos: number | null;
}

interface Absolute {
  start: number | null;
  end: number | null;
  packetPos: number;
}

interface InitAudioMessage {
  type: "initAudio";
  memory: {
    buffers: Buffers,
    pointers: Pointers,
    };
  };



interface StopMessage {
  type: "STOP";
}

interface BounceMessage {
  type: "bounce_to_mix";
}

type ProcessorMessage = InitAudioMessage | AudioProcessorData | StopMessage | BounceMessage;

class AudioProcessor extends AudioWorkletProcessor {
  packetSize: number = CONSTANTS.PACKET_SIZE;
  halfSecondInSamples: number;
  fiftymsInSamples: number;
  maxTimelineSample: number;
  PROCESS_FRAMES: number;

  buffers: ProcessorBuffers;
  readers: ProcessorReaders;
  state: ProcessorState;
  timeline: Timeline;
  absolute: Absolute;

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: "MIX_MASTER_VOLUME",
        defaultValue: 1.0,
        minValue: 0,
        maxValue: 1.0,
        automationRate: "k-rate",
      },
      {
        name: "STAGING_MASTER_VOLUME",
        defaultValue: 1.0,
        minValue: 0,
        maxValue: 1.0,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();

    this.halfSecondInSamples = Math.round(0.5 * sampleRate);
    this.fiftymsInSamples = Math.round(.05 * sampleRate);
    this.maxTimelineSample = Math.round(60 * sampleRate);
    this.PROCESS_FRAMES = 128;

    this.buffers = {
      staging: null,
      mix: null,
      record: null,
    };

    this.readers = {
      staging: null,
      mix: null,
      record: null,
    };

    this.state = {
      isRecording: false,
      isPlaying: false,
      isStreaming: false,
      looping: false,
      packetCount: 0,
      count: {
        bounce: 0,
        take: -1,
      },
    };

    this.timeline = {
      start: null,
      end: null,
      pos: null,
    };

    this.absolute = {
      start: null,
      end: null,
      packetPos: 0,
    };

    this.port.onmessage = (e: MessageEvent<ProcessorMessage>) => this.handleMessage(e.data);
  }

  handleMessage(data: ProcessorMessage): void {
    if (data.type === "initAudio") {
      console.log("Audio Worklet inited");
      const mem = data.memory;
      this.buffers.staging = new RingSAB(
        mem.buffers.staging,
        {
          read: mem.pointers.staging.read,
          write: mem.pointers.staging.write,
          isFull: mem.pointers.staging.isFull,
        },
        mem.pointers.staging.read
      );
      this.buffers.mix = new RingSAB(
        mem.buffers.mix,
        {
          read: mem.pointers.mix.read,
          write: mem.pointers.mix.write,
          isFull: mem.pointers.mix.isFull,
        },
        mem.pointers.mix.read
      );
      this.buffers.record = new RingSAB(
        mem.buffers.record,
        {
          read: mem.pointers.record.readStream,
          read2: mem.pointers.record.readOPFS,
          write: mem.pointers.record.write,
          isFull: mem.pointers.record.isFull,
        },
        mem.pointers.record.readStream,
      );
      this.readers = {
        staging: new Float32Array(this.PROCESS_FRAMES),
        mix: new Float32Array(this.PROCESS_FRAMES * CONSTANTS.MIX_MAX_TRACKS),
        record: new Float32Array(this.packetSize),
      };
    }
    if (data.type === "START_RECORDING" || data.type === "START_PLAYBACK") {
      console.log("starting recording or playback with data", data);
      Object.assign(this.state, data.state);
      Object.assign(this.timeline, {
        start: Math.round(sampleRate * data.timeline.start),
        end: Math.round(sampleRate * data.timeline.end),
        pos: Math.round(sampleRate * data.timeline.pos),
      });
      const absStart = Math.round((currentTime + .05) * sampleRate);
      const looping = this.state.looping;
      Object.assign(this.absolute, {
        start: absStart,
        end: this.timeline.end && !looping ? absStart + this.timeline.end! - this.timeline.start! : null,
        packetPos: 0,
      });
      this.buffers.mix?.resetPointers();
      this.buffers.record?.resetPointers();
      this.buffers.staging?.resetPointers();  
    }
    if (data.type === "STOP") {
      if (this.state.isRecording) {
        this.port.postMessage({
          type: "add_region",
          timelineStart: this.timeline.start,
          timelineEnd: Math.round(this.timeline.start! + ((sampleRate * currentTime - this.absolute.start!) % (this.timeline.end! - this.timeline.start!))),
          takeNumber: this.state.count.take,
          bounceNumber: this.state.count.bounce,
          fileName: `bounce_${this.state.count.bounce}_take_${this.state.count.take}`,
          delayCompensation: [0],
        });
      }
      this.absolute.end = currentTime + .5;
      this.state.isPlaying = false;
      this.state.isRecording = false;
    }
    if ("actiontype" in data && data.actiontype === "bounce_to_mix") {
      this.state.count.bounce += 1;
      this.state.count.take = -1;
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    if (!this.state.isRecording && !this.state.isPlaying) return true;
    if (currentFrame + this.PROCESS_FRAMES < this.absolute.start!) return true;

    if (this.absolute.end) {
      if (currentFrame > this.absolute.end) { this.state.isPlaying = false; }
      if (currentFrame > this.absolute.end + this.halfSecondInSamples) { this.state.isRecording = false; }
    }

    const framesToDelay = 0; //Math.max(0,this.absolute.start-currentFrame);
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // take samples from the input stream and write them in the ring buffer; recording is mono
    for (let j = framesToDelay; j < this.PROCESS_FRAMES; j++) {
      if (!this.state.isRecording) break;

      if (this.absolute.packetPos >= this.packetSize) {
        this.buffers.record!.write(this.readers.record!, 0, this.packetSize);
        this.absolute.packetPos = 0;
      }
      this.readers.record![this.absolute.packetPos] = input[0][j];
      this.absolute.packetPos++;
    }

    if (this.state.isPlaying && this.buffers.staging && this.readers.staging) {
      this.buffers.staging.read(this.readers.staging, 0, this.PROCESS_FRAMES);
    }

    if (this.buffers.mix && this.readers.mix) {
      this.buffers.mix.readMultiTrack(this.readers.mix, CONSTANTS.MIX_MAX_TRACKS, this.PROCESS_FRAMES);
    }

    const output = outputs[0];
    for (let i = 0; i < this.PROCESS_FRAMES; i++) {
      if (!this.state.isRecording && !this.state.isPlaying) break;
      for (let channel = 0; channel < 2; channel++) {
        output[channel][i] = (this.state.isPlaying ? this.readers.staging![i] : 0);

        for (let track = 0; track < CONSTANTS.MIX_MAX_TRACKS; track++) {
          output[channel][i] += this.readers.mix![track * this.PROCESS_FRAMES + i];
        }
      }
    }
    return true;
  }
}

registerProcessor("AudioProcessor", AudioProcessor);
