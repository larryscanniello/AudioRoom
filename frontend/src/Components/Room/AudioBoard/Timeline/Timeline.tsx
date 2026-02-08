
type TimelineProps = {
    children: React.ReactNode,
    timelinePxLen: number,
    compactMode: number,
}

export default function Timeline({children,timelinePxLen,compactMode}:TimelineProps) {
    

    return <div className="grid overflow-x-auto relative border-black border-0 shadow-sm shadow-blak grid-cols-2 scrollwindow"
                        style={{width:timelinePxLen,height:Math.floor(150*compactMode)}}>
                {children}
        </div>
}