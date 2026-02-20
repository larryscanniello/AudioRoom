import type { State, TransactionData } from "@/Core/State/State";
import type { SocketManager } from "../Sockets/SocketManager";
import type { EventTypes } from "./EventNamespace";
import type { StateContainer } from "@/Core/State/State";

type ExecuteSocketData = {
    type: keyof typeof EventTypes;
    transactionData: TransactionData;
    sharedSnapshot: Partial<StateContainer>;
}


export function stateTransactionUtil(state: State, transactionData: TransactionData, _sharedState: boolean): boolean {
        return state.transaction(transactionData);
    };

export function executeSocketUtil(socketManager: SocketManager, data: ExecuteSocketData): void {
    socketManager.emit("event", data);
}