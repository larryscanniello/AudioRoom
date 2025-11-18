// useAudioRecorder.js
import { useRef, useEffect, useState } from 'react';

export const useAudioRecorder = (
  {AudioCtxRef, metronomeRef,socket, roomID, setAudio,
  setAudioChunks,setAudioURL,setDelayCompensation, setDelayCompensationAudio, 
  onDelayCompensationComplete, setMouseDragStart, setMouseDragEnd,    
  playheadRef,metronomeOn,waveform1Ref,BPM,scrollWindowRef,currentlyRecording,
  setPlayheadLocation,isDemo,delayCompensation,BPMRef
}
) => {
  const mediaRecorderRef = useRef(null);
  const delayCompensationRecorderRef = useRef(null);
  const streamRef = useRef(null);
  

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
        
        // Setup main recorder
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        let chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          chunks.push(e.data);
        };

        mediaRecorder.onstart = () => {
          handleRecording(metronomeRef);
        }

        mediaRecorder.onstop = async (e) => {
          console.log("recorder stopped");
          // Send chunks to server
          if(!isDemo){
            for (let i = 0; i < chunks.length; i++) {
              socket.current.emit("send_audio_client_to_server", {
                audio: chunks[i],
                roomID,
                i,
                user: "all",
                length: chunks.length,
                delayCompensation
              });
            }
          }

          const blob = new Blob(chunks, { type: "audio/webm; codecs=opus" });
          const webmArrayBuffer = await blob.arrayBuffer();
          console.log('blob',blob,'webmArrayBuffer',webmArrayBuffer);
          const decoded = await AudioCtxRef.current.decodeAudioData(webmArrayBuffer);
          setAudioChunks([...chunks]);
          setAudio(decoded);
          setMouseDragStart({trounded:0,t:0});
          setMouseDragEnd(null);
          setPlayheadLocation(0);
          chunks = [];

          //setAudioURL(audioURLtemp);
          
        };

        // Setup delay compensation recorder
        const delayCompRecorder = new MediaRecorder(stream);
        delayCompensationRecorderRef.current = delayCompRecorder;
        
        let delayChunks = [];

        delayCompRecorder.ondataavailable = (e) => {
          delayChunks.push(e.data);
        };

        delayCompRecorder.onstop = async (e) => {
            console.log("Delay compensation recorder stopped");
            const blob = new Blob(delayChunks, { type: "audio/ogg; codecs=opus" });
            const arrayBuffer = await blob.arrayBuffer();
            const decoded = await AudioCtxRef.current.decodeAudioData(arrayBuffer);
            let greatestAvg = 0;
            let greatestIndex = 0;
            const dataArray = decoded.getChannelData(0);
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
            delayChunks = [];
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
  }, [AudioCtxRef.current, roomID, socket, delayCompensation]);

  const startRecording = () => {
    if(mediaRecorderRef.current){
      mediaRecorderRef.current.start()
    }
  }

  // Recording control functions
  const handleRecording = async (metRef) => {
    if (mediaRecorderRef.current && metRef.current) {
        if (AudioCtxRef.current.state === "suspended") {
          await AudioCtxRef.current.resume();
        }

        currentlyRecording.current = true;
        
        const now = AudioCtxRef.current.currentTime

        if(metronomeOn){
            metRef.current.currentBeatInBar = 0;
            metRef.current.start(now);
        }
        
        
        const updatePlayhead = () => {
                const rect = waveform1Ref.current.getBoundingClientRect();
                const pixelsPerSecond = rect.width/((60/BPMRef.current)*128)
                const waveformCtx = waveform1Ref.current.getContext("2d");
                const elapsed = AudioCtxRef.current.currentTime - now;
                setPlayheadLocation(elapsed);                
                const x = (elapsed * pixelsPerSecond);
                if(x>=waveform1Ref.current.width){
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
                    requestAnimationFrame(updatePlayhead);
                }
            }
        updatePlayhead()
        console.log("Recording started");
    }
  }

  const stopRecording = (metRef) => {
    if (mediaRecorderRef.current && metRef.current) {
        currentlyRecording.current = false;
        metRef.current.stop();
        mediaRecorderRef.current.stop();
        console.log("Recording stopped");
    }
  }

  const startDelayCompensationRecording = (metRef) => {
    if (delayCompensationRecorderRef.current && metRef.current) {
      const prevtempo = metRef.current.tempo;
      const now = AudioCtxRef.current.currentTime;
      metRef.current.tempo = 120;
      metRef.current.start(now);
      delayCompensationRecorderRef.current.start();
      console.log("Delay compensation recording started");
      setTimeout(() => {
        metronomeRef.current.stop();
        metRef.current.tempo = prevtempo
      }, 400);
      setTimeout(()=>{
        delayCompensationRecorderRef.current.stop();
      },1000)
    }
  }


  return {
    startRecording,
    stopRecording,
    startDelayCompensationRecording,
    isRecorderReady: !!mediaRecorderRef.current
  };
};
