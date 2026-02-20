import type { State, TransactionData } from "@/Core/State/State";
import type { SocketManager } from "../Sockets/SocketManager";


export function stateTransactionUtil(state: State, transactionData: TransactionData, _sharedState: boolean): boolean {
        return state.transaction(transactionData);
    };

export function executeSocketUtil(socketManager: SocketManager, data: any): void {
    socketManager.emit("event", data);
}