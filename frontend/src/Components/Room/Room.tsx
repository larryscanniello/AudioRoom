import { useWindowSize } from "../useWindowSize.tsx";
import { useEffect,useRef,useState } from "react";
import { useParams } from "react-router-dom"
import { SessionBuilder } from "@/Core/Builders/SessionBuilder.ts";

import VideoBox from "./VideoBox/VideoBox.tsx";
import JoinRoomButton from "./VideoBox/JoinRoomButton.tsx";
import ToggleMicButton from "./VideoBox/VideoChatControls/ToggleLocalMicButton.tsx";
import ToggleRemoteMicButton from "./VideoBox/VideoChatControls/ToggleRemoteMicButton.tsx";

import type { AudioController } from "@/Core/Audio/AudioController.ts";
import type { UIController } from "@/Core/UI/UIController.ts";
import type { PeerJSManager } from "@/Core/WebRTC/PeerJSManager.ts";
import RemoteVolumeSlider from "./VideoBox/VideoChatControls/RemoteVolumeSlider.tsx";
import AudioBoard from "./AudioBoard/AudioBoard.tsx";

export default function Room() {
    const [_width,height] = useWindowSize();
    const [validRoom, setValidRoom] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [roomJoined, setRoomJoined] = useState<boolean>(false);
    const [_dawInternalState, setDawInternalState] = useState<number>(0);
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

       
      }
      init();

      return () => {

        webRTCManagerRef.current?.terminate();
      };
    }, []);

    async function initDAW(){
       const filepaths = {
          opfsFilePath: "/opfs_worker.ts",
          workletFilePath: "/AudioProcessor.js",
        }
    
        const builderResult = await new SessionBuilder(roomID)
          .withReact(setDawInternalState)
          .withAudEngine("worklet", filepaths)
          .withMixTracks(16)
          .withPeerJSWebRTC()
          .build();

        if(!builderResult){
          throw new Error("Session builder failed, returned null");
        }

        const {audioController,uiController,webRTCManager} = builderResult;

        audioControllerRef.current = audioController;
        console.log('uiController from builderResult', uiController);
        uiControllerRef.current = uiController;
        if(!webRTCManager){
          throw new Error("Session builder failed to create WebRTC manager");
        }

        webRTCManager.initializePeer();
        if(!roomID){
          throw new Error("No room ID found in URL params");
        }
        webRTCManager.joinSocketRoom(roomID);

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

    useEffect(()=>{
      if(uiControllerRef.current){
        uiControllerRef.current.drawAllCanvases();
      }
    },[roomJoined])

    

    console.log('uiControllerRef',uiControllerRef.current);

    return <div className="flex flex-col h-screen">
        {validRoom ? <div>
        <VideoBox 
        webRTCManager={webRTCManagerRef.current}
        height={height}
        roomJoined={roomJoined}
          />
        {!roomJoined && <JoinRoomButton setRoomJoined={setRoomJoined} initDAW={initDAW} roomJoined={roomJoined}/>}
        {roomJoined && <div><ToggleMicButton gainNodesRef={gainNodesRef} micsMuted={micsMuted} setMicsMuted={setMicsMuted} />
        <ToggleRemoteMicButton gainNodesRef={gainNodesRef} micsMuted={micsMuted} setMicsMuted={setMicsMuted} />
        <RemoteVolumeSlider remoteVolume={remoteVolume} 
                            setRemoteVolume={setRemoteVolume} 
                            gainNodesRef={gainNodesRef} 
                            micsMuted={micsMuted} />
        </div>}
        {roomJoined && <AudioBoard audioControllerRef={audioControllerRef} uiControllerRef={uiControllerRef} webRTCManagerRef={webRTCManagerRef}/>} 
        </div> 
        
        : <div className="flex flex-col items-center">
            <div className="text-4xl pt-40">{errorMessage}</div>
          </div>
        }
    

    </div>
}