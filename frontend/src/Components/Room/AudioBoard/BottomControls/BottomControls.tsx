
type BottomControlsProps = {
    children: React.ReactNode,
    compactMode: number
}

export default function BottomControls({children,compactMode}: BottomControlsProps){
    return <div className="row-start-3 grid grid-cols-[20px_370px_150px_75px_75px_250px]" 
     style={{height:Math.floor(32*compactMode),transform:`${compactMode!=1?"translateY(3px)":""}`}}>
        {children}
    </div>
}