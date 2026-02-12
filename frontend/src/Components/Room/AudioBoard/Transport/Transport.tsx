import { ButtonGroup } from "@mui/material";

type TransportProps = {
    children: React.ReactNode,
    compactMode: number
}

export default function Transport({children,compactMode}: TransportProps){
    return <div className="row-start-3 grid grid-cols-[20px_400px_125px_75px_75px_250px]" 
     style={{height:Math.floor(32*compactMode),transform:`${compactMode!=1?"translateY(3px)":""}`}}>
        <ButtonGroup className="rounded border-1 border-gray-300 col-start-2"
                            style={{transform:compactMode!=1?"scale(.7) translate(-55px,-10px)":""}}
                        >
        {children}
        </ButtonGroup>
    </div>
}