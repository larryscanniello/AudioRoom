import { useWindowSize } from "../useWindowSize.tsx";
import { useEffect,useRef,useState } from "react";
import { useParams } from "react-router-dom"
import { SessionBuilder } from "@/Classes/Builders/SessionBuilder";

import VideoBox from "./VideoBox/VideoBox.tsx";
import JoinRoomButton from "./VideoBox/JoinRoomButton.tsx";
import ToggleMicButton from "./VideoBox/VideoChatControls/ToggleLocalMicButton.tsx";
import ToggleRemoteMicButton from "./VideoBox/VideoChatControls/ToggleRemoteMicButton.tsx";

import type { AudioController } from "@/Classes/Audio/AudioController";
import type { UIController } from "@/Classes/UI/UIController";
import type { PeerJSManager } from "@/Classes/WebRTC/PeerJSManager.ts";
import RemoteVolumeSlider from "./VideoBox/VideoChatControls/RemoteVolumeSlider.tsx";
import AudioBoard from "./AudioBoard.tsx";

export default function Room() {
    const [width,height] = useWindowSize();
    const [validRoom, setValidRoom] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [roomJoined, setRoomJoined] = useState<boolean>(false);
    const [dawInternalState, setDawInternalState] = useState<number>(0);
    const [micsMuted, setMicsMuted] = useState<{local: boolean, remote: boolean}>({local: false, remote: false});
    const [remoteVolume, setRemoteVolume] = useState<number>(100);


    const gainNodesRef = useRef<{local: GainNode | null, remote: GainNode | null}>({local:null, remote:null});
    const audioControllerRef = useRef<AudioController|null>(null);
    const uiControllerRef = useRef<UIController|null>(null);
    const webRTCManagerRef = useRef<PeerJSManager|null>(null);

    const {roomID} = useParams();

    useEffect(() => {
    
      async function init() {
        const response = await fetch(
          import.meta.env.VITE_BACKEND_URL + "/getroom/" + roomID,
          {
            credentials: "include",
            method: "GET",
          }
        );
    
        if (!response.ok) {
          setValidRoom(false);
          setErrorMessage("Error");
          return;
        }

        setValidRoom(true);
        console.log(`Joining room ${roomID}`);
    
      
        /*
        socketManagerRef.current.on("file_transfer", (data:any) => {
          setSharedFile(data);
        });*/
    
        const {audioController,uiController,webRTCManager} = new SessionBuilder(roomID)
          .withReact(setDawInternalState)
          .withAudEngine("worklet")
          .withMixer()
          .withPeerJSWebRTC()
          .build();

        audioControllerRef.current = audioController;
        uiControllerRef.current = uiController;
        webRTCManagerRef.current = webRTCManager;
        webRTCManagerRef.current?.loadStream()
          .then((localGain)=>{
            gainNodesRef.current.local = localGain;
            if(micsMuted.local && gainNodesRef.current.local){
              gainNodesRef.current.local.gain.value = 0.0;
            }
          })
          .catch((err)=>{
            throw new Error("Error loading local media stream:",err);
          });
      }
      

    
      init();
      
    
      /* ------------------ Cleanup ------------------ */
      return () => {

        webRTCManagerRef.current?.terminate();
      };
    }, [roomID]);

    


    return <div className="flex flex-col h-screen">
        {validRoom ? <div>
        <VideoBox 
        webRTCManager={webRTCManagerRef.current}
        height={height}
        roomJoined={roomJoined}
          />
        <JoinRoomButton webRTCManager={webRTCManagerRef.current} setRoomJoined={setRoomJoined}/>
        <ToggleMicButton gainNodesRef={gainNodesRef} micsMuted={micsMuted} setMicsMuted={setMicsMuted} />
        <ToggleRemoteMicButton gainNodesRef={gainNodesRef} micsMuted={micsMuted} setMicsMuted={setMicsMuted} />
        <RemoteVolumeSlider remoteVolume={remoteVolume} 
                            setRemoteVolume={setRemoteVolume} 
                            gainNodesRef={gainNodesRef} 
                            micsMuted={micsMuted} />
        <AudioBoard/> 
        </div> 
        
        : <div className="flex flex-col items-center">
            <div className="text-4xl pt-40">{errorMessage}</div>
          </div>
        }
    

    </div>
}