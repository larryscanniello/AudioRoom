import { PeerJSManager } from "@/Core/WebRTC/PeerJSManager";
import { useEffect, useRef } from "react";

interface VideoProps {
  webRTCManagerRef: React.RefObject<PeerJSManager | null>;
  height: number;
  roomJoined: boolean;
}

export default function VideoBox({webRTCManagerRef,height,roomJoined}: VideoProps) {

  const localStreamRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<HTMLVideoElement>(null);

  console.log("WebRTC manager in VideoBox:", webRTCManagerRef.current);

  const localStream = webRTCManagerRef.current?.getLocalStream();
  const remoteStream = webRTCManagerRef.current?.getRemoteStream(); 

  console.log("Local stream in VideoBox:", localStream);

  useEffect(() => {
      if (localStreamRef.current && localStream) {
        localStreamRef.current.srcObject = localStream;
      }
      if (remoteStreamRef.current && remoteStream) {
        remoteStreamRef.current.srcObject = remoteStream;
      }
  }, [localStream, remoteStream]);

  

  
  if (!localStream && !remoteStream) {
    return <div>No streams available</div>;
  }

  
  console.log("Rendering VideoBox with localStream and remoteStream:", {
    localStream,
    remoteStream,
  });

    return <div className="video-box relative flex justify-center"
                style={{
                    width: 1050,
                    height: height - (height < 700 ? 235 * (4 / 7) : 235),
                }}>
    {remoteStream && (
              <video
                ref={remoteStreamRef}
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
    {(!remoteStream && roomJoined) && <div className="bg-white border-1 border-gray-700 text-black absolute px-4 py-1 rounded-2xl">Waiting for partner to join room</div>}
    <video
      ref={localStreamRef}
      autoPlay
      playsInline
      muted
      className={
        !remoteStreamRef.current
          ? "bg-black"
          : "absolute top-4 right-4 w-48 h-32 object-cover border border-white/30 shadow-lg bg-black"
      }
      style={{
        width: !remoteStreamRef.current ? 1050 : undefined,
        height: !remoteStreamRef.current
          ? height - (height < 700 ? 235 * (4 / 7) : 235)
          : undefined,
        objectFit: "cover",
      }}
    />
    </div>
}