
export class Mixer {
    private audioContext: AudioContext;
    private channelGains: GainNode[] = [];
    private masterGain: GainNode;
    private metronomeGain: GainNode;

    constructor(audioContext: AudioContext, numberOfChannels: number = 16) {
        this.audioContext = audioContext;
        const analyser = this.audioContext.createAnalyser();
        analyser.minDecibels = -90;
        analyser.maxDecibels = 0;

        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.8; // Default master volume
        this.masterGain.connect(this.audioContext.destination);

        this.metronomeGain = this.audioContext.createGain();
        this.metronomeGain.gain.value = 0.5;

        for (let i = 0; i < numberOfChannels; i++) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 1.0; // Default channel volume
            gainNode.connect(this.masterGain);
            this.channelGains.push(gainNode);
        }

    }

    public getAudioContext(): AudioContext {
        return this.audioContext;
    }

    public getChannelGain(channelIndex: number): GainNode | null {
        if (channelIndex < 0 || channelIndex >= this.channelGains.length) {
            console.warn(`Channel index ${channelIndex} is out of bounds.`);
            return null;
        }
        return this.channelGains[channelIndex];
    }

    public getMasterGain(): GainNode {
        return this.masterGain;
    }

    public getMetronomeGain(): GainNode {
        return this.metronomeGain;
    }

    public muteChannel(channelIndex: number): void {
        this.setChannelGain(channelIndex, 0);
    }

    public unmuteChannel(channelIndex: number): void {
        this.setChannelGain(channelIndex, this.getChannelGain(channelIndex)?.gain.defaultValue || 1.0);
    }

    public setChannelGain(channelIndex: number, value: number): void {
        const gainNode = this.getChannelGain(channelIndex);
        if (gainNode) {
            gainNode.gain.value = value;
        }
    }

    public setMasterGain(value: number): void {
        this.masterGain.gain.value = value;
    }

    public setMetronomeGain(value: number): void {
        this.metronomeGain.gain.value = value;
    }   


}