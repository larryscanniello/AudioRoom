import type { PeerJSManager } from "@/Core/WebRTC/PeerJSManager";
import { useParams } from "react-router-dom";

type JoinRoomButtonProps = {
    webRTCManager: PeerJSManager|null;
    setRoomJoined: (show: boolean) => void;
}



export default function JoinRoomButton({webRTCManager, setRoomJoined}: JoinRoomButtonProps) {

    const {roomID} = useParams();

    const onClick = () => {
        if(!webRTCManager){
            throw new Error("WebRTC manager not initialized in JoinRoomButton");
        }
        webRTCManager.initializePeer();
        if(!roomID){
            throw new Error("No room ID found in URL params");
        }
        webRTCManager.joinSocketRoom(roomID);
        setRoomJoined(true);
    }

    return <button
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white bg-blue-700 rounded-xl px-6 py-2 hover:bg-blue-800"
                onClick={onClick}
                >
                Join Room
            </button>
}