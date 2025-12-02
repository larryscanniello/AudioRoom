// useAudioRecorder.js
import { useRef, useEffect, useState } from 'react';


export const useAudioRecorder = (
  {AudioCtxRef, metronomeRef,socket, roomID, setAudio,
  setAudioChunks,setAudioURL,setDelayCompensation, setDelayCompensationAudio, 
  onDelayCompensationComplete, setMouseDragStart, setMouseDragEnd,    
  playheadRef,metronomeOn,waveform1Ref,BPM,scrollWindowRef,currentlyRecording,
  setPlayheadLocation,isDemo,delayCompensation,BPMRef,recorderRef,recordAnimationRef,
  metronomeOnRef,gain2Ref,metronomeGainRef,
}
) => {
  const mediaRecorderRef = useRef(null);
  const delayCompensationRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordedBuffersRef = useRef(null);
  const delayCompensationRef = useRef(null);
  
  delayCompensationRef.current = delayCompensation;

  // Initialize media stream and recorders
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("getUserMedia not supported on your browser!");
      return;
    }

    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        streamRef.current = stream;

        await AudioCtxRef.current.resume();
        const source = AudioCtxRef.current.createMediaStreamSource(stream);
        await AudioCtxRef.current.audioWorklet.addModule("/RecorderProcessor.js");
        const processor = new AudioWorkletNode(AudioCtxRef.current,'RecorderProcessor');
        source.connect(processor);
        processor.connect(gain2Ref.current);
        

        const startRecording = (audio2,delayComp) => {
          recordedBuffersRef.current = [];
          processor.port.postMessage({
            actiontype:"start",
            buffer:audio2 ? audio2.getChannelData(0).slice():[],
            delayCompensation:delayComp
          });
          handleRecording(metronomeRef);
        }

        const stopRecording = () => {
          processor.port.postMessage({actiontype:"stop"});
        };
        
        processor.port.onmessage = (event) => {
          let recordedBuffers = event.data.buffer;
          if(recordedBuffers.length==0){return;}
          let chunks = [];
          for(let i=0;i<recordedBuffers.length;i++){
            if(i%16==0){
              chunks.push(recordedBuffers[i]);
            }else{
              chunks[Math.floor(i/16)] = [...chunks[Math.floor(i/16)],...recordedBuffers[i]];
            }
          }
          recordedBuffers = chunks;
          
  
          const length = recordedBuffers.reduce((sum,arr) => sum+arr.length,0)
          const fullBuffer = new Float32Array(length);
          let offset = 0;
          for(const arr of recordedBuffers){
            fullBuffer.set(arr,offset)
            offset += arr.length;
          }
        

          const audioBuffer = AudioCtxRef.current.createBuffer(1,fullBuffer.length,AudioCtxRef.current.sampleRate);
          audioBuffer.copyToChannel(fullBuffer,0);

          setAudioChunks(recordedBuffers);
          setAudio(audioBuffer);
          setMouseDragStart({trounded:0,t:0});
          setMouseDragEnd(null);
          setPlayheadLocation(0);

          if(!isDemo){
            for (let i = 0; i < recordedBuffers.length; i++) {
              socket.current.emit("send_audio_client_to_server", {
                audio: recordedBuffers[i],
                roomID,
                i,
                user: "all",
                length: recordedBuffers.length,
                delayCompensation:delayCompensationRef.current
              });
            }
          }

          recordedBuffersRef.current = [];
        }

        recorderRef.current = {processor,startRecording,stopRecording};
        // Setup delay compensation recorder
        const delayCompRecorder = new AudioWorkletNode(AudioCtxRef.current,'RecorderProcessor');
        delayCompensationRecorderRef.current = delayCompRecorder;
        source.connect(delayCompRecorder);
        delayCompRecorder.connect(AudioCtxRef.current.destination);

        delayCompRecorder.port.onmessage = (event) => {
            console.log("Delay compensation recorder stopped");
            const recordedBuffers = event.data.buffer;
            const length = recordedBuffers.reduce((sum,arr) => sum+arr.length,0)
            const fullBuffer = new Float32Array(length);
            let offset = 0;
            for(const arr of recordedBuffers){
              fullBuffer.set(arr,offset)
              offset += arr.length;
            }
            let greatestAvg = 0;
            let greatestIndex = 0;
            const dataArray = fullBuffer;
            for(let i=0;i<dataArray.length-50;i++){
                let avg = 0
                for(let j=i;j<i+50;j++){
                    avg += Math.abs(dataArray[j])/50;
                }
                if(avg>greatestAvg){
                    greatestAvg = avg;
                    greatestIndex = i
                }
            }
            setDelayCompensation([greatestIndex])
            if(!isDemo){
              socket.current.emit("send_latency_client_to_server",{
              roomID,delayCompensation:[greatestIndex]
            })
            }
        };

      } catch (err) {
        console.error(`The following getUserMedia error occurred: ${err}`);
      }
    };

    initializeMedia();

    // Cleanup
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  },[]);
  
  //[AudioCtxRef.current, roomID, socket, delayCompensation,recorderRef.current]);

  const startRecording = () => {}

  // Recording control functions
const updatePlayhead = (waveformRef,now) => {
    if(!currentlyRecording.current){return;}
    const rect = waveformRef.current.getBoundingClientRect();
    const pixelsPerSecond = rect.width/((60/BPMRef.current)*128)
    const waveformCtx = waveformRef.current.getContext("2d");
    const elapsed = AudioCtxRef.current.currentTime - now;
    setPlayheadLocation(elapsed);                
    const x = (elapsed * pixelsPerSecond);
    if(x>=waveformRef.current.width){
      stopRecording(metRef);
      return
    }
    const visibleStart = scrollWindowRef.current.scrollLeft
    const visibleEnd = visibleStart + 1000
    if((x-visibleStart)/(visibleEnd-visibleStart)>(10/11)){
        scrollWindowRef.current.scrollLeft = 750 + visibleStart;
    }
    waveformCtx.clearRect(0,0,rect.width,rect.height)
    waveformCtx.fillStyle = "rgb(0,75,200)"
    waveformCtx.globalAlpha = .20
    waveformCtx.fillRect(0,0,x,rect.height)
    if(currentlyRecording.current){
        requestAnimationFrame(()=>updatePlayhead(waveformRef,now));
    }
}

recordAnimationRef.current = updatePlayhead;

  const handleRecording = async (metRef) => {
    if (recorderRef.current && metRef.current) {
        if (AudioCtxRef.current.state === "suspended") {
          await AudioCtxRef.current.resume();
        }

        currentlyRecording.current = true;
        
        const now = AudioCtxRef.current.currentTime;

        metRef.current.currentBeatInBar = 0;
        metRef.current.start(now);
        
        recordAnimationRef.current(waveform1Ref,now);
        console.log("Recording started");
    }
  }

  const stopRecording = (metRef) => {
    if (recorderRef.current && metRef.current) {
        currentlyRecording.current = false;
        metRef.current.stop();
        console.log("Recording stopped");
    }
  }

  const startDelayCompensationRecording = (metRef) => {
    if (delayCompensationRecorderRef.current && metRef.current) {
      const prevtempo = metRef.current.tempo;
      const prevMetronomeGain = metronomeGainRef.current.gain.value;
      const now = AudioCtxRef.current.currentTime;
      metRef.current.tempo = 120;
      metronomeGainRef.current.gain.value = 1.0;
      metRef.current.start(now);
      delayCompensationRecorderRef.current.port.postMessage({actiontype:"start",buffer:[]});
      console.log("Delay compensation recording started");
      setTimeout(() => {
        metronomeRef.current.stop();
        metRef.current.tempo = prevtempo
        metronomeGainRef.current.gain.value = prevMetronomeGain;
      }, 400);
      setTimeout(()=>{
        delayCompensationRecorderRef.current.port.postMessage({actiontype:"stop"});
      },1000)
    }
  }


  return {
    startRecording,
    stopRecording,
    startDelayCompensationRecording,
    isRecorderReady: !!recorderRef.current
  };
};
