
type JoinRoomButtonProps = {
    setRoomJoined: (show: boolean) => void;
    initDAW: () => Promise<void>;
    roomJoined: boolean;
}

export default function JoinRoomButton({setRoomJoined, initDAW, roomJoined}: JoinRoomButtonProps) {

    const onClick = async () => {
        if(roomJoined){
            console.warn("Already joined room, ignoring click");
            return;
        }
        await initDAW();
        setRoomJoined(true);
    }
    return <button
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white bg-blue-700 rounded-xl px-6 py-2 hover:bg-blue-800"
                onClick={onClick}
                >
                Join Room
            </button>
}