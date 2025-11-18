
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");
const pool = require('./db')


const socketManager = async (server,sessionMiddleware) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL, // Your client URL
      methods: ["GET", "POST"],
      credentials: true,
    }
  });

  const userList = []

  io.use(sharedSession(sessionMiddleware,{
    autoSave: true,
  }));

  io.on('connection', async (socket) => {
    let userID;
    let roomIDglobal;
    if (socket.handshake.session.passport?.user) {
      userID = socket.handshake.session.passport.user;
      console.log("User ID:", userID);
      
    } else {
      console.log("Unauthenticated socket");
    }
    
    // Listen for a 'join_room' event
    socket.on('join_room', async (roomID) => {
      socket.join(roomID);
      roomIDglobal = roomID;
      const data = await pool.query("SELECT * FROM USERS WHERE id = $1",[userID]);
      userList.push([data.rows[0].username,userID])
      io.to(roomID).emit("user_list_server_to_client",userList)
      socket.to(roomID).emit('request_audio_server_to_client',{user:userID});
      console.log(`User ${socket.handshake.session.passport.user} joined room: ${roomID}`);
    });

    socket.on("send_audio_client_to_server",(data)=>{
      if(data.user==="all"){
        socket.to(data.roomID).emit("receive_audio_server_to_client",data)
      }else{
        socket.to(data.roomID).emit("receive_audio_server_to_client",data)
      }
    })

    socket.on("client_to_server_play_audio",(data)=>{
      socket.to(data.roomID).emit("server_to_client_play_audio",{})
    })

    socket.on("send_audio_chunk", (data) => {
      // forward chunk to everyone else in the room
      socket.to(data.roomID).emit("receive_audio_chunk",{chunk:data.chunk,first:data.first})
      
    });

    socket.on("stop_audio_client_to_server",(roomID)=>{
      socket.to(roomID).emit("stop_audio_server_to_client");
    })

    socket.on("send_play_window_to_server",(data)=>{
      socket.to(data.roomID).emit("send_play_window_to_clients",data);
    })

    socket.on("receive_bpm_client_to_server", (data)=> {
      socket.to(data.roomID).emit("send_bpm_server_to_client",data.BPM);
    })

    socket.on("handle_skipback_client_to_server",(roomID)=>{
      socket.to(roomID).emit("handle_skipback_server_to_client");
    })

    socket.on("send_latency_client_to_server",(data)=>{
      socket.to(data.roomID).emit("send_latency_server_to_client",data.delayCompensation);
    })

    socket.on("disconnect",()=>{
      for(let i=0;i<userList.length;i++){
        if(userList[i][1]===userID){
          userList.splice(i,1);
          console.log(userList)
          break
        }
      }
      socket.to(roomIDglobal).emit("user_list_server_to_client",userList)
    })

  });

  return io;
};

module.exports = socketManager;