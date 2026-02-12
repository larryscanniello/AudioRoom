import {useRef} from "react";
import { CONSTANTS } from "@/Constants/constants";

type TrackListProps = {
    children: React.ReactNode,
    compactMode: number
}

export default function TrackList({children,compactMode}: TrackListProps){

    const controlPanelRef = useRef<HTMLDivElement>(null);

    return <div
                ref={controlPanelRef}
                className="col-start-2 "
                style={{width:`${CONSTANTS.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(150*compactMode)}}
            >
                    {children}
        </div>    
}