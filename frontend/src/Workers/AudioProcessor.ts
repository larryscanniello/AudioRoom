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
  bpm: number;
  count: {
    bounce: number;
    take: number;
    globalTake: number;
    globalPlayCount: number;
  };
  latency: {
    totalDelayCompensationSamples: number;
    ctxLatencySamples: number;
  }
}

//all in samples, all relative to the start of the timeline (not absolute time)
interface Timeline {
  start: number | null;
  end: number | null;
  pos: number | null;
  stopSamples: number | null;
}

//all in samples, absolute time
interface Absolute {
  start: number | null;
  end: number | null;               // non-looping playback end frame; nulled after firing
  recordingEnd: number | null;      // frame at which to send add_region + stop recording
  packetPos: number;
}

interface InitAudioMessage {
  type: "initAudio";
  memory: {
    buffers: Buffers,
    pointers: Pointers,
    };
  };

interface LatencyTestData {
  barker13: Float32Array;
  barker13Elongated: Float32Array;
  barker13PlaybackPos: number;
  isLatencyTesting: boolean;
  samplesRecorded: number;
  totalSamples: number;
  recording: Float32Array | null;
}

interface StopMessage {
  type: "STOP";
  sharedSnapshot: {
    //really this has an entire shared snapshot
    playheadTimeSeconds: number;
  }
}

interface BounceMessage {
  type: "bounce_to_mix";
}

interface InitMetronomeMessage {
  type: "initMetronome";
  clickBuffer: Float32Array;
}

interface LatencyTestMessage {
  type: "START_LATENCY_TEST";
}

type ProcessorMessage = InitAudioMessage | AudioProcessorData | StopMessage | BounceMessage | InitMetronomeMessage | LatencyTestMessage;

class AudioProcessor extends AudioWorkletProcessor {
  packetSize: number = CONSTANTS.PACKET_SIZE;
  halfSecondInSamples: number;
  fiftymsInSamples: number;
  maxTimelineSample: number;
  PROCESS_FRAMES: number;
  latencyTestData: LatencyTestData = {
    barker13: new Float32Array([1,1,1,1,1,-1,-1,1,1,-1,1,-1,1]),
    barker13Elongated: new Float32Array([1,1,1,1,1,-1,-1,1,1,-1,1,-1,1].flatMap(v => Array(50).fill(v))), // each chip repeated 50 times = 650 samples
    barker13PlaybackPos: 0,
    isLatencyTesting: false,
    samplesRecorded: 0,
    totalSamples: 0,
    recording: null,
  }
  buffers: ProcessorBuffers;
  readers: ProcessorReaders;
  state: ProcessorState;
  timeline: Timeline;
  absolute: Absolute;
  clickBuffer: Float32Array | null;
  clickPlaybackPos: number;
  nextClickSample: number;

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
      {
        name: "METRONOME_GAIN",
        defaultValue: 0,
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
    this.maxTimelineSample = Math.round(CONSTANTS.TIMELINE_LENGTH_IN_SECONDS * sampleRate);
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
      bpm: 100,
      count: {
        bounce: 0,
        globalTake: -1,
        take: -1,
        globalPlayCount: -1,
      },
      latency:{
        totalDelayCompensationSamples: 0,
        ctxLatencySamples: 0,
      }
    };

    this.clickBuffer = null;
    this.clickPlaybackPos = -1;
    this.nextClickSample = 0;

    this.timeline = {
      start: null,
      end: null,
      pos: null,
      stopSamples: null,
    };

    this.absolute = {
      start: null,
      end: null,
      recordingEnd: null,
      packetPos: 0,
    };

    this.port.onmessage = (e: MessageEvent<ProcessorMessage>) => this.handleMessage(e.data);
  }

  handleMessage(data: ProcessorMessage): void {
    if (data.type === "initMetronome") {
      this.clickBuffer = data.clickBuffer;
    }
    if (data.type === "initAudio") {
      console.log("Audio Worklet inited");
      const mem = data.memory;
      this.buffers.staging = new RingSAB(
        mem.buffers.staging,
        {
          read: mem.pointers.staging.read,
          write: mem.pointers.staging.write,
          isFull: mem.pointers.staging.isFull,
          globalCount: mem.pointers.staging.globalCount,
        },
        mem.pointers.staging.read
      );
      this.buffers.mix = new RingSAB(
        mem.buffers.mix,
        {
          read: mem.pointers.mix.read,
          write: mem.pointers.mix.write,
          isFull: mem.pointers.mix.isFull,
          globalCount: mem.pointers.mix.globalCount,  
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
          globalCount: mem.pointers.record.globalCount,
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
      this.buffers.mix?.resetPointers();
      this.buffers.record?.resetPointers();
      this.buffers.staging?.resetPointers()  
      Object.assign(this.state, data.state);
      Object.assign(this.timeline, {
        start: Math.round(sampleRate * data.timeline.start),
        end: Math.round(sampleRate * data.timeline.end),
        pos: Math.round(sampleRate * data.timeline.pos),
      });
      const absStart = currentFrame + Math.floor(this.PROCESS_FRAMES * this.fiftymsInSamples) / this.PROCESS_FRAMES; // add 50ms to account for scheduling delay, rounded to nearest process block  
      const looping = this.state.looping;
      Object.assign(this.absolute, {
        start: absStart,
        end: this.timeline.end && !looping ? absStart + this.timeline.end! - this.timeline.start! : null,
        packetPos: 0,
      });
      const samplesPerBeat = Math.round(sampleRate * 60 / this.state.bpm);
      const samplesToNextBeat = samplesPerBeat - (this.timeline.pos! % samplesPerBeat);
      this.nextClickSample = absStart + (samplesToNextBeat % samplesPerBeat);
      this.clickPlaybackPos = -1;
      this.buffers.record?.storeGlobalCount(this.state.count.globalTake);
      this.buffers.staging?.storeGlobalCount(this.state.count.globalPlayCount);
      this.buffers.record?.notify();
      this.buffers.staging?.notify();
    }
    if (data.type === "STOP") {
      if (this.state.isRecording) {
        // Save timeline position at the moment of manual stop (for later add_region)
        this.timeline.stopSamples = Math.round(data.sharedSnapshot.playheadTimeSeconds * sampleRate);
        // Keep recording 0.5s of headroom; add_region sent when window closes
        this.absolute.recordingEnd = Math.round(currentTime * sampleRate + this.halfSecondInSamples);
        this.port.postMessage({
          type: "add_region",
          timelineStart: this.timeline.start,
          timelineEnd: this.timeline.stopSamples,
          takeNumber: this.state.count.take,
          bounceNumber: this.state.count.bounce,
          fileName: `bounce_${this.state.count.bounce}_take_${this.state.count.take}`,
          delayCompensation: this.state.latency.totalDelayCompensationSamples,
        });
      }
      // Null out absolute.end so the auto-stop path in process() never fires for manual stops
      this.absolute.end = null;
      this.state.isPlaying = false;
      // Do NOT set isRecording = false here; handled when recordingEnd is reached
    }
    if ("actiontype" in data && data.actiontype === "bounce_to_mix") {
      this.state.count.bounce += 1;
      this.state.count.take = -1;
    }
    if (data.type === "START_LATENCY_TEST") {
      this.absolute.start = currentFrame + Math.floor(this.PROCESS_FRAMES * this.fiftymsInSamples) / this.PROCESS_FRAMES; // add 50ms to account for scheduling delay, rounded to nearest process block
      this.latencyTestData.barker13PlaybackPos = 0;
      this.latencyTestData.samplesRecorded = 0;
      this.latencyTestData.totalSamples = sampleRate; // 1 second
      this.latencyTestData.recording = new Float32Array(sampleRate);
      this.latencyTestData.isLatencyTesting = true;
    }
  }

  // Compute the next click sample, accounting for non-beat-aligned loop boundaries.
  // When looping, advancing by samplesPerBeat past the loop end would place the click at
  // the wrong position. Instead we compute how far to the loop end, then how far from the
  // loop start to the first beat of the next iteration.
  #nextClickSample(firedAt: number, samplesPerBeat: number): number {
    const loopStart = this.timeline.start;
    const loopEnd   = this.timeline.end;
    if (!this.state.looping || loopStart === null || loopEnd === null) {
      return firedAt + samplesPerBeat;
    }
    const loopLength = loopEnd - loopStart;
    if (loopLength <= 0) return firedAt + samplesPerBeat;

    // Timeline position at which this beat fired
    const loopOffset = (firedAt - this.absolute.start!) % loopLength;
    const tlPos = loopStart + loopOffset;

    const tlNext = tlPos + samplesPerBeat;
    if (tlNext < loopEnd) {
      // Next beat is within the same loop iteration — simple advance
      return firedAt + samplesPerBeat;
    }

    // Next beat crosses the loop boundary.
    // Find the first beat at or after loopStart in the next iteration.
    const firstBeatAfterStart = Math.ceil(loopStart / samplesPerBeat) * samplesPerBeat;
    const nextTlPos = firstBeatAfterStart < loopEnd ? firstBeatAfterStart : loopStart;
    const framesToLoopEnd    = loopEnd - tlPos;
    const framesAfterWrap    = nextTlPos - loopStart;
    return firedAt + framesToLoopEnd + framesAfterWrap;
  }

  #crossCorrelateBarker13(recorded: Float32Array): number {
    const signal = this.latencyTestData.barker13Elongated;
    const signalLen = signal.length;
    let maxCorr = -Infinity;
    let bestLag = 0;
    const maxLag = recorded.length - signalLen;
    for (let lag = 0; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < signalLen; i++) {
        corr += recorded[lag + i] * signal[i];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }
    return bestLag;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {

    //This if handles the latency test
    if (this.latencyTestData.isLatencyTesting && this.absolute.start! <= currentFrame) {
      const input = inputs[0];
      const output = outputs[0];
      for (let i = 0; i < this.PROCESS_FRAMES; i++) {
        const pos = this.latencyTestData.barker13PlaybackPos;
        const s = pos < this.latencyTestData.barker13Elongated.length
          ? this.latencyTestData.barker13Elongated[pos]
          : 0;
        if (pos < this.latencyTestData.barker13Elongated.length) {
          this.latencyTestData.barker13PlaybackPos++;
        }
        if (output[0]) output[0][i] = s;
        if (output[1]) output[1][i] = s;
      }
      if (input && input[0] && this.latencyTestData.recording) {
        const offset = this.latencyTestData.samplesRecorded;
        const end = Math.min(offset + this.PROCESS_FRAMES, this.latencyTestData.recording.length);
        this.latencyTestData.recording.set(input[0].subarray(0, end - offset), offset);
        this.latencyTestData.samplesRecorded += this.PROCESS_FRAMES;
      }
      if (this.latencyTestData.samplesRecorded >= this.latencyTestData.totalSamples) {
        this.latencyTestData.isLatencyTesting = false;
        const delaySamples = this.#crossCorrelateBarker13(this.latencyTestData.recording!);
        this.port.postMessage({ type: "latency_test_done", delaySamples });
        this.latencyTestData.recording = null;
      }
      return true;
    }

    if (!this.state.isRecording && !this.state.isPlaying) return true;
    if (currentFrame + this.PROCESS_FRAMES < this.absolute.start!) return true;

    // Auto-stop: non-looping playback/record or looping record reached timeline end
    if (this.absolute.end !== null && currentFrame >= this.absolute.end) {
      this.state.isPlaying = false;
      if (this.state.isRecording) {
        this.timeline.stopSamples = this.timeline.end!;
        this.absolute.recordingEnd = this.absolute.end + this.halfSecondInSamples;
        this.port.postMessage({
          type: "add_region",
          timelineStart: this.timeline.start,
          timelineEnd: this.timeline.stopSamples,
          takeNumber: this.state.count.take,
          bounceNumber: this.state.count.bounce,
          fileName: `bounce_${this.state.count.bounce}_take_${this.state.count.take}`,
          delayCompensation: this.state.latency.totalDelayCompensationSamples,
        });
      }
      this.absolute.end = null; // prevent re-firing
      this.port.postMessage({ type: "playback_ended" });
    }


    // Recording window close (manual or auto stop)
    if (this.absolute.recordingEnd !== null && currentFrame > this.absolute.recordingEnd) {
      this.state.isRecording = false;
      this.absolute.recordingEnd = null;
      this.timeline.stopSamples = null;
      
    }

    const input = inputs[0];

    if (!input || !input[0]) return true;

    // take samples from the input stream and write them in the ring buffer; recording is mono
    // NOTE: start time is strategically set to arrive at exactly the start of a process block

    for (let j = 0; j < this.PROCESS_FRAMES; j++) {
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

    const stagingGain = parameters["STAGING_MASTER_VOLUME"][0];
    const mixGain = parameters["MIX_MASTER_VOLUME"][0];

    const output = outputs[0];

    for (let i = 0; i < this.PROCESS_FRAMES; i++) {
      if (!this.state.isRecording && !this.state.isPlaying) break;
      for (let channel = 0; channel < 2; channel++) {
        output[channel][i] = (this.state.isPlaying ? this.readers.staging![i] * stagingGain : 0);

        for (let track = 0; track < CONSTANTS.MIX_MAX_TRACKS; track++) {
          output[channel][i] += this.readers.mix![track * this.PROCESS_FRAMES + i] * mixGain;
        }
      }
    }

    //handle metronome clicks
    const isValidPlaybackTime = !this.absolute.recordingEnd && (this.state.isPlaying || this.state.isRecording) //otherwise met would play in .5 seconds after recording stopped
    if (this.clickBuffer && isValidPlaybackTime) { 
      const metrGain = parameters["METRONOME_GAIN"][0];
      const samplesPerBeat = Math.round(sampleRate * 60 / this.state.bpm);
      for (let i = 0; i < this.PROCESS_FRAMES; i++) {
        const absFrame = currentFrame + i;
        if (absFrame >= this.nextClickSample && this.clickPlaybackPos === -1) {
          this.clickPlaybackPos = 0;
          this.nextClickSample = this.#nextClickSample(this.nextClickSample, samplesPerBeat);
        }
        const pastTimelineEnd = this.absolute.end !== null && absFrame >= this.absolute.end;
        if (this.clickPlaybackPos >= 0 && this.clickPlaybackPos < this.clickBuffer.length && !pastTimelineEnd) {
          if (metrGain > 0) {
            const s = this.clickBuffer[this.clickPlaybackPos] * metrGain;
            output[0][i] += s;
            output[1][i] += s;
          }
          this.clickPlaybackPos++;
        }
        if (this.clickPlaybackPos >= this.clickBuffer.length) {
          this.clickPlaybackPos = -1;
        }
      }
    }

    return true;
  }
}

registerProcessor("AudioProcessor", AudioProcessor);
