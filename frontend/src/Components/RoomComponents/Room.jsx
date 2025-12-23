import AudioBoard from "./AudioBoard"
import { useEffect,useContext,useState, useRef,useCallback } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client"
import { useWindowSize } from "../useWindowSize";
import Peer from "peerjs";

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
    const localStreamRef = useRef(null);
    const peerRef = useRef(null);
    const callRef = useRef(null);
    const setVideoRef = useRef(null);
    const [initializeAudioRecorder,setInitializeAudioRecorder] = useState(false); //piece of state so that children (useAudioRecorder) useeffect are triggered later
    const localVideoRef = useRef(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const remoteVideoRef = useRef(null);
    const [showJoinRoom,setShowJoinRoom] = useState(true);

useEffect(() => {
  let mounted = true;

  async function init() {
    /* ------------------ 1. Verify room ------------------ */
    const response = await fetch(
      import.meta.env.VITE_BACKEND_URL + "/getroom/" + roomID,
      {
        credentials: "include",
        method: "GET",
      }
    );

    if (!response.ok) {
      if (!mounted) return;
      setRoomResponse(false);
      setErrorMessage("Error");
      return;
    }

    if (!mounted) return;
    setRoomResponse(true);
    console.log(`Joining room ${roomID}`);

    /* ------------------ 2. Socket connection ------------------ */
    const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
      withCredentials: true,
    });
    socket.current = newSocket;

    newSocket.on("PDF_transfer_server_to_client", data => {
      setPDF(data);
    });


    /* ------------------ 3. Get local media ------------------ */
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
      }
    });
    localStreamRef.current = localStream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    /* ------------------ 4. Create PeerJS ------------------ */
    
    setInitializeAudioRecorder(true);
  }

  init();
  

  /* ------------------ Cleanup ------------------ */
  return () => {
    mounted = false;

    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  };
}, [roomID]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);


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

    const initializePeer = () => {
      const peer = new Peer();
      peerRef.current = peer;

      peer.on("open", peerId => {
        console.log("PeerJS open:", peerId);

        socket.current.emit("peer-id", {
          roomID: roomID,
          peerId,
        });
      });

      /* ------------------ 5. Incoming calls ------------------ */
      peer.on("call", call => {
        console.log("Incoming call");
        call.answer(localStreamRef.current);
        attachCallHandlers(call);
      });

      /* ------------------ 6. Server tells us to call someone ------------------ */
      socket.current.on("call-peer", (peerId) => {
        console.log("Calling peer:", peerId);
        const call = peer.call(peerId, localStreamRef.current);
        attachCallHandlers(call);
      });

      /* ------------------ helpers ------------------ */
      function attachCallHandlers(call) {
        call.on("stream", (incomingStream) => {
          console.log("Received remote stream");
          setRemoteStream(incomingStream); // Store the stream in state
        });

        call.on("close", () => {
          setRemoteStream(null);
        });

        socket.current.on("user_disconnected_server_to_client",()=>{
          setRemoteStream(null);
        })

        call.on("error", err => {
          console.error("Call error:", err);
        });
      
    }
    }

    return <div>
    {roomResponse ? (
      <div className="flex flex-col h-screen"
        onDragOver={handleDragOver}
      >
          <div className="flex w-full justify-center">
          <div className="flex-grow"></div> 
          <div className="relative flex justify-center">
            {/* Remote video */}
            {remoteStream && (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="bg-black"
                style={{
                  width: 1050,
                  height: height - (height < 700 ? 235 * (4 / 7) : 235),
                  objectFit: "cover",
                }}
              />
            )}
            {(!remoteStream && !showJoinRoom) && <div className="bg-white border-1 border-gray-700 text-black absolute px-4 py-1 rounded-2xl">Waiting for partner to join room</div>}
            {/* Local video (single instance, always mounted) */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={
                !remoteStream
                  ? "bg-black"
                  : "absolute top-4 right-4 w-48 h-32 object-cover border border-white/30 shadow-lg bg-black"
              }
              style={{
                width: !remoteStream ? 1050 : undefined,
                height: !remoteStream
                  ? height - (height < 700 ? 235 * (4 / 7) : 235)
                  : undefined,
                objectFit: "cover",
              }}
            />

            {showJoinRoom && (
              <button
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white bg-blue-700 rounded-xl px-6 py-2 hover:bg-blue-800"
                onClick={() => {
                  initializePeer();
                  setShowJoinRoom(false);
                }}
              >
                Join Room
              </button>
            )}
          </div>
          {/*<div
            ref={setVideoRef}
            style={{
              width: 1050,
              height: height - (height < 700 ? 235 * (4 / 7) : 235),
              position: "relative",
            }}
            className="shrink-0"
          >
          </div>*/}
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
          localStreamRef={localStreamRef}
          initializeAudioRecorder={initializeAudioRecorder}
        />
      </div>
    ) : (
      <div className="flex flex-col items-center">
        <div className="text-4xl pt-40">{errorMessage}</div>
      </div>
    )}
  </div>
}