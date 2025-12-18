import AudioBoard from "./AudioBoard"
import { useEffect,useContext,useState, useRef,useCallback } from "react";
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
    const [firstEnteredRoom,setFirstEnteredRoom] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [PDF,setPDF] = useState(null);

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
        newSocket.on("PDF_transfer_server_to_client",data=>{
          console.log('msg',data)
          setPDF(data);
        })

    },[])

    const videoRef = useRef(null);
    const callRef = useRef(null);
    const hasInitialized = useRef(false);

     const setVideoRef = (element) => {
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

    const setVideoAudio = (mute) => {
      callRef.current.setLocalAudio(mute);
    }

    const handleDragOver = (e) => {
        e.preventDefault(); 
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
       /* if (!file || file.type !== 'application/pdf') {
            alert('Please drop a PDF file.');
            return;
        }*/
        const MAX_SIZE_BYTES = 2 * 100 * 1024; // 2 MB limit for PoC
        if (file.size > MAX_SIZE_BYTES) {
            alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 2 MB.`);
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Data = event.target.result;
            setPDF(base64Data);
            if (socket.current) {
              socket.current.emit("PDF_transfer_client_to_server",{message:base64Data,roomID})
              console.log('check41');
            } else {
                console.error("Socket not connected!");
            }
        };

        reader.readAsDataURL(file);
    }

    const onPDFClose = (e) => {
      setPDF(null);
      socket.current.emit("PDF_transfer_client_to_server",{message:null,roomID})
    }

    const handleBackdropClick = ()=>{}
    const onClose = () => {}

    return <div>
    {roomResponse ? (
      <div className="flex flex-col h-screen"
        onDragOver={handleDragOver}
      >
          <div className="flex w-full justify-center">
          <div className="flex-grow"></div> 
          <div
            ref={setVideoRef}
            style={{
              width: 1050,
              height: height - (height < 700 ? 235 * (4 / 7) : 235),
              position: "relative",
            }}
            className="shrink-0"
          >
          </div>
          <div 
            style={{
              width: PDF?Math.floor(width/2):Math.floor((width - 1050)/2),
            }}
            className={"border-2 border-dashed flex justify-center items-center transition-colors duration-150 " + 
             (!!!PDF ? (isDragging ? " border-blue-500  text-blue-700" : "border-gray-800 text-gray-500") : "")}
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <div className="">
            
            {PDF ?
            <div className="pdf-viewer-wrapper">
            <button
              onClick={onPDFClose}
              className="absolute top-2 right-2 z-10 rounded-full bg-black/70 text-white w-8 h-8 flex items-center justify-center hover:bg-black"
              aria-label="Close PDF"
            >
              ×
            </button>
            <iframe 
                src={PDF}
                style={{ 
                    width:Math.floor(width/2),
                    height:height - (height < 700 ? 235 * (4 / 7) : 235),
                    border: '1px solid #ccc' 
                }}
            ></iframe>
        </div>
              
              :
              
              <div className="border-gray-500 rounded-3xl text-gray-600">
              {!!!PDF && "Drag and drop sheet music here"}
            </div>
            
            }
            </div>
          </div>
        </div>
        <AudioBoard
          isDemo={false}
          socket={socket}
          firstEnteredRoom={firstEnteredRoom}
          setFirstEnteredRoom={setFirstEnteredRoom}
          setVideoAudio={setVideoAudio}
        />
      </div>
    ) : (
      <div className="flex flex-col items-center">
        <div className="text-4xl pt-40">{errorMessage}</div>
      </div>
    )}
  </div>
}