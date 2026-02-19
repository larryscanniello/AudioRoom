
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");
const pool = require('./db')


const roomStates = new Map();

const socketManager = async (server,sessionMiddleware) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    }
  });

  io.use(sharedSession(sessionMiddleware,{
    autoSave: true,
  }));

  io.on('connection', async (socket) => {
    let userID;
    let roomIDglobal;
    if (socket?.handshake?.session?.passport?.user) {
      userID = socket.handshake.session.passport.user;
      console.log("User ID:", userID);
    } else {
      console.log("Unauthenticated socket");
    }
    
    // Listen for a 'join_room' event
    socket.on('JOIN_SOCKET_ROOM', async ({state}) => {
      socket.data.roomID = state.roomID;
      await socket.join(state.roomID);

      const size = io.sockets.adapter.rooms.get(state.roomID)?.size ?? 0;

      if(size === 1 && !roomStates.has(state.roomID)){  
        roomStates.set(state.roomID, state);
      }else{
        socket.emit('sync_state', roomStates.get(state.roomID));
      }

      //socket.to(roomID).emit('request_audio_server_to_client');
      io.in(state.roomID).emit('JOIN_SOCKET_ROOM', {size});
      console.log(`User has joined room: ${state.roomID}`);
    });

    socket.on('state_transaction',({transactionData}) => {
      return;
      if(!socket.data.roomID) return;
      transaction(transactionData,socket.data.roomID);
      const mutations = roomStates.get(socket.data.roomID);
      socket.to(socket.data.roomID).emit('state_transaction',{mutations});
    })

    socket.on("disconnect", () => {
      if (!socket.data.roomID) return;

      const size = io.sockets.adapter.rooms.get(socket.data.roomID)?.size ?? 0;
      if(size === 0){
        roomStates.delete(socket.data.roomID);
      }
      io.in(socket.data.roomID).emit("comm_event",{type:"partner_left"})
      io.in(socket.data.roomID).emit("user_disconnected_server_to_client", size);
    });

  });

  return io;
};

function transaction(transaction,roomID){
    let canExecute = true;
    for(let tQuery of transaction.transactionQueries){
        canExecute = canExecute && comparitor(tQuery,roomID);
    }
    if(canExecute){
      const currentState = roomStates.get(roomID);
        for(let mutation of transaction.mutations){
            currentState[mutation.key] = mutation.value;
        }
        return transaction.mutations;
    }else{
        return [];
    }
}



function comparitor(q,roomID){
      const {key, comparitor, target} = q;
      const currentState = roomStates.get(roomID);
      const currentValue = currentState[key];
      if(comparitor === "==="){
          return currentValue === target;
      }
      if(typeof currentValue !== "number" || typeof target !== "number"){
              console.error(`Comparitor ${comparitor} is only valid for number types. 
                  Current value type: ${typeof currentValue}, target type: ${typeof target}`);
              return false;   
      }
      switch(comparitor){
          case "<":
              return currentValue < target;
          case ">":
              return currentValue > target;
          case "<=":
              return currentValue <= target;
          case ">=":
              return currentValue >= target;
      }
}


module.exports = socketManager;