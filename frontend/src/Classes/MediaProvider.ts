
export class MediaProvider {
    #standaloneMode: boolean = false;
    #AVStream: MediaStream | null = null;
    #audioStream: MediaStream | null = null;
    #remoteStream: MediaStream | null = null; 
    #audioContext: AudioContext;

    constructor(audioContext: AudioContext,standaloneMode:boolean) {
        this.#audioContext = audioContext;
        this.#standaloneMode = standaloneMode;
    }

    setRemoteStream(stream: MediaStream|null) {
        this.#remoteStream = stream;
    }

    getAudioStream(): MediaStream {
        if(!this.#audioStream){
            throw new Error("Audio Stream has not been loaded yet");
        }
        return this.#audioStream;
    }

    getAVStream(): MediaStream {
        if(this.#standaloneMode){
            throw new Error("AV Stream is not available in standalone mode");
        }
        if(!this.#AVStream){
            throw new Error("AV Stream has not been loaded yet");
        }
        return this.#AVStream;
    }

    getAudioContext(): AudioContext {
        return this.#audioContext;
    }

    async loadStream(): Promise<GainNode|null>{
        const config = {
            video:!this.#standaloneMode,
            audio:{
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
        }};
        return await navigator.mediaDevices.getUserMedia(config)
        .then((stream) => {
            const audioSource = this.#audioContext.createMediaStreamSource(stream);
            const chatGain = this.#audioContext.createGain();
            audioSource.connect(chatGain);
            const destination = this.#audioContext.createMediaStreamDestination();
            chatGain.connect(destination);

            this.#AVStream = new MediaStream([
                stream.getVideoTracks()[0],
                destination.stream.getAudioTracks()[0]
            ]);
            this.#audioStream = new MediaStream(this.#AVStream.getAudioTracks());
            return chatGain
        })
        .catch((err) => {
            console.error('Error accessing av stream:', err);
            return null;
        });
    }


    terminate(){
        this.#AVStream?.getTracks().forEach(track => track.stop());
        this.#audioStream?.getTracks().forEach(track => track.stop());
    }
}