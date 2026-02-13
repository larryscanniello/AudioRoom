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
    const builderRef = useRef<SessionBuilder|null>(null);
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

        builderRef.current = await new SessionBuilder(roomID)
          .withReact(setDawInternalState)
          .withAudEngine("worklet", {
            opfsFilePath: "/opfs_worker.ts",
            workletFilePath: "/AudioProcessor.js",
          })
          .withMixTracks(16)
          .withSockets()
          .withPeerJSWebRTC()
          .buildRTC();

        webRTCManagerRef.current = builderRef.current.getWebRTCManager();
        console.log('WebRTC manager from builder:', webRTCManagerRef.current);

        if(!webRTCManagerRef.current){
          throw new Error("Session builder failed to create WebRTC manager");
        }

        webRTCManagerRef.current.initializePeer();
        if(!roomID){
          throw new Error("No room ID found in URL params");
        }
        webRTCManagerRef.current.joinSocketRoom(roomID);

        await webRTCManagerRef.current.loadStream()
          .then((localGain)=>{
            gainNodesRef.current.local = localGain;
            if(micsMuted.local && gainNodesRef.current.local){
              gainNodesRef.current.local.gain.value = 0.0;
            }
          })
          .catch((err)=>{
            throw new Error("Error loading local media stream:",err);
          });

        //rerender so that components that depend on webRTCManager (ex: VideoBox) will update with the new stream info
        setDawInternalState(performance.now());

        console.log("WebRTC manager after initialization:", webRTCManagerRef.current);
       
      }
      init();

      return () => {

        webRTCManagerRef.current?.terminate();
      };
    }, []);

    async function initDAW(){
    
        const builderResult = await builderRef.current?.build();

        if(!builderResult){
          throw new Error("Session builder failed, returned null");
        }

        const {audioController,uiController} = builderResult;

        audioControllerRef.current = audioController;

        uiControllerRef.current = uiController;
        
    }

    useEffect(()=>{
      if(uiControllerRef.current){
        uiControllerRef.current.drawAllCanvases();
      }
    },[roomJoined])

    

    console.log('validRoom:', validRoom);

    return <div>
        {validRoom ? <div className="flex flex-col h-screen">
         <div className="flex w-full justify-center">
        <div className="relative flex justify-center">
        <VideoBox 
        webRTCManagerRef={webRTCManagerRef}
        height={height}
        roomJoined={roomJoined}
          />
        {!roomJoined && <JoinRoomButton setRoomJoined={setRoomJoined} initDAW={initDAW} roomJoined={roomJoined}/>}
        {roomJoined && <div className="absolute bottom-2 left-2 flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-md"
        ><ToggleMicButton gainNodesRef={gainNodesRef} micsMuted={micsMuted} setMicsMuted={setMicsMuted} />
        <ToggleRemoteMicButton gainNodesRef={gainNodesRef} micsMuted={micsMuted} setMicsMuted={setMicsMuted} />
        <RemoteVolumeSlider remoteVolume={remoteVolume} 
                            setRemoteVolume={setRemoteVolume} 
                            gainNodesRef={gainNodesRef} 
                            micsMuted={micsMuted} />
        </div>}
        </div>
        </div>
        {roomJoined && <AudioBoard audioControllerRef={audioControllerRef} uiControllerRef={uiControllerRef} webRTCManagerRef={webRTCManagerRef}/>} 
        </div>
        : <div className="flex flex-col items-center">
            <div className="text-4xl pt-40">{errorMessage}</div>
          </div>
        }

    </div>
}