

export default function TrackList({children}){

    return <div
                ref={params.controlPanelRef}
                className="col-start-2 "
                style={{width:`${params.LEFT_CONTROLS_WIDTH}px`,height:Math.floor(150*params.compactMode)}}
            >
                    {children}
        </div>    
}