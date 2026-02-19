
import type { Socket } from "socket.io-client";
import type { GlobalContext } from "../Mediator";
import { EventTypes } from "../Events/EventNamespace";
import { Play } from "../Events/Audio/Play";
import { Stop } from "../Events/Audio/Stop";
import { SetNumConnectedUsers } from "../Events/Sockets/SetNumberOfConnectedUsers";

export default function socketOns(socket: Socket, context: GlobalContext){

    socket.on(EventTypes.JOIN_SOCKET_ROOM,(size:number)=>{
        console.log("Received JOIN_SOCKET_ROOM event from server");
        context.dispatch(SetNumConnectedUsers.getDispatchEvent({param: size, emit: false}));
        context.commMessage("Partner connected to DAW.","white");
    });

    socket.on(EventTypes.START_PLAYBACK, () => {
        context.dispatch(Play.getDispatchEvent({param: null,emit: false}));
        context.commMessage("Partner played audio","white");
    });

    socket.on(EventTypes.STOP, () => {
        context.dispatch(Stop.getDispatchEvent({param: null,emit: false}));
        context.commMessage("Partner stopped audio","white");
    });



}