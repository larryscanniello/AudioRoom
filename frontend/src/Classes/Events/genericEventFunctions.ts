import type { State, TransactionData } from "@/Classes/State";
import type { SocketManager } from "../Sockets/SocketManager";
import { EventTypes } from "./EventNamespace"


export function stateTransactionUtil(state: State, transactionData: TransactionData, _sharedState: boolean): boolean {
        return state.transaction(transactionData);
    };

export function executeSocketUtil(socketManager: SocketManager, data: any): void {
    socketManager.emit("state_transaction", data);
}