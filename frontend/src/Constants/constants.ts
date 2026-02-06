export const SAMPLE_RATE = 48000;
export const TIMELINE_LENGTH_IN_SECONDS = 15 * 60; // 15 minutes
export const MIX_MAX_TRACKS = 16;
export const PACKET_SIZE = 960;
export const MIPMAP_HALF_SIZE = 2**22;
export const MINIMUM_WAVEFORM_WINDOW_LEN = 900;
const resolutions = [MIPMAP_HALF_SIZE];
let curr = MIPMAP_HALF_SIZE;
while(curr > MINIMUM_WAVEFORM_WINDOW_LEN){
    curr = curr / 2;
    resolutions.push(curr);
}
export const MIPMAP_RESOLUTIONS = resolutions;
export const MIN_SAMPLES_PER_PX = 10;
export const EVENT_QUEUE_LENGTH = 100000;