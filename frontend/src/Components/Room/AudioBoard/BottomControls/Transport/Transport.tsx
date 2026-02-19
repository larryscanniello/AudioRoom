import { ButtonGroup } from "@mui/material";

type TransportProps = {
    children: React.ReactNode,
    compactMode: number
}

export default function Transport({children,compactMode}: TransportProps){
    return <ButtonGroup className="rounded border-1 border-gray-300 col-start-2"
                            style={{transform:compactMode!=1?"scale(.7) translate(-55px,-10px)":""}}
                        >
        {children}
        </ButtonGroup>
}