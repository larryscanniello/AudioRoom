type JoinRoomButtonProps = {
    webRTCManager?: PeerJSManager;
    setRoomJoined: (show: boolean) => void;
}

export default function JoinRoomButton({webRTCManager, setRoomJoined}: JoinRoomButtonProps) {
    return <button
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white bg-blue-700 rounded-xl px-6 py-2 hover:bg-blue-800"
                onClick={() => {
                    webRTCManager?.initializePeer();
                    setRoomJoined(true);
                }}
                >
                Join Room
            </button>
}