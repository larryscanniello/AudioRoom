import AudioBoard from "./AudioBoard"
import { useEffect,useContext,useState, useRef } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client"
import DailyIframe from '@daily-co/daily-js';
import { useWindowSize } from "../useWindowSize";

export default function Room(){
    const [roomResponse,setRoomResponse] = useState(false);
    const {roomID} = useParams();
    const socket = useRef(null);
    const [userList,setUserList] = useState([])
    const [width,height] = useWindowSize();
    const [errorMessage,setErrorMessage] = useState("Loading...")

    useEffect(()=>{
        async function verifyRoom(){
            const response = await fetch(import.meta.env.VITE_BACKEND_URL+"/getroom/" + roomID, {
                credentials: "include",
                method: "GET",
            });
            if (response.ok) {
                setRoomResponse(true);
                console.log(`Attempting to join socket room: ${roomID}`);
            } else {
                setRoomResponse(false);
                setErrorMessage("Error");
            }
        }
        verifyRoom()
        const newSocket = io(import.meta.env.VITE_BACKEND_URL, { withCredentials: true });
        socket.current = newSocket;
    },[])

    const videoRef = useRef(null);
    const callRef = useRef(null);
    const hasInitialized = useRef(false);

     const setVideoRef = (element) => {
      console.log('check',element);
      videoRef.current = element;
      
      // Initialize Daily when the element becomes available
      if (element && !hasInitialized.current) {
        hasInitialized.current = true;
        
        const roomUrl = 'https://audio-board.daily.co/demo-room';
        
        const callFrame = DailyIframe.createFrame(element, {
          showLeaveButton: true,
        });
        
        callFrame.join({ url: roomUrl });
        callRef.current = callFrame;
      }
    };

    useEffect(() => {
      return () => {
        // Clean up
        if (callRef.current) {
          callRef.current.leave();
          callRef.current.destroy();
        }
      };
    }, []);

    return <div>
    {(roomResponse) ? 
    <div>
    <div className="flex items-center justify-center">
    <div
        ref={setVideoRef}
        style={{
            width: 1050,
            height: height-(height<700?235*(4/7):235),
            position: "relative",
        }}
    >
    </div>
    </div> 
    <AudioBoard isDemo={false} socket={socket}/>
    </div> 
    : <div className="flex flex-col items-center"><div className="text-4xl pt-40">{errorMessage}</div></div>}
    </div>
}