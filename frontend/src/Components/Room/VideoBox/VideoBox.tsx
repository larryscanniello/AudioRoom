import { PeerJSManager } from "@/Classes/WebRTC/PeerJSManager";
import { JoinRoomButton } from "./JoinRoomButton";

interface VideoProps {
  webRTCManager: PeerJSManager | null;
  height: number;
  roomJoined: boolean;
}

export default function VideoBox({webRTCManager,height,roomJoined}: VideoProps) {
    return <div>
    {remoteStreamRef.current && (
              <video
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
            {(!remoteStreamRef.current && !showJoinRoom) && <div className="bg-white border-1 border-gray-700 text-black absolute px-4 py-1 rounded-2xl">Waiting for partner to join room</div>}
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