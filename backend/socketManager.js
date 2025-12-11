
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
    socket.on('join_room', async (roomID) => {
      roomIDglobal = roomID;
      await socket.join(roomID);

      const size = io.sockets.adapter.rooms.get(roomID)?.size ?? 0;

      socket.to(roomID).emit('request_audio_server_to_client');
      io.in(roomID).emit('user_connected_server_to_client', size);
      console.log(`User has joined room: ${roomID}`);
    });

    socket.on("send_audio_client_to_server",(data)=>{
        socket.to(data.roomID).emit("receive_audio_server_to_client",data)
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
    });

    socket.on("handle_skipback_client_to_server",(roomID)=>{
      socket.to(roomID).emit("handle_skipback_server_to_client");
    });

    socket.on("send_latency_client_to_server",(data)=>{
      socket.to(data.roomID).emit("send_latency_server_to_client",data.delayCompensation);
    });

    socket.on("start_recording_client_to_server",(roomID)=>{
      socket.to(roomID).emit("start_recording_server_to_client");
    });

    socket.on("client_to_server_incoming_audio_done_processing",(roomID)=>{
      socket.to(roomID).emit("server_to_client_incoming_audio_done_processing");
    })

    socket.on("client_to_server_audio_deleted",({roomID,track})=>{
      socket.to(roomID).emit("server_to_client_delete_audio",track);
    })

    socket.on("looping_client_to_server",data=>{
      socket.to(data.roomID).emit("looping_server_to_client",data.looping);
    })

    socket.on("comm_audio_played_client_to_server",(roomID)=>{
      socket.to(roomID).emit("comm_audio_played_server_to_client");
    });

    socket.on("comm_audio_stopped_client_to_server",roomID=>{
      socket.to(roomID).emit("comm_audio_stopped_server_to_client");
    });

    socket.on("comm_recording_started_client_to_server",(roomID)=>{
      socket.to(roomID).emit("comm_recording_started_server_to_client");
    });

    socket.on("comm_recording_stopped_client_to_server",roomID=>{
      socket.to(roomID).emit("comm_recording_stopped_server_to_client");
    });

    socket.on("comm_looping_changed_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_looping_changed_server_to_client",data.status)
    })

    socket.on("comm_looping_changed_partner_to_click_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_looping_changed_partner_to_click_server_to_client",data.looping);
    })

    socket.on("comm_metronome_onoff_changed_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_metronome_onoff_changed_server_to_client",data.status)
    })

    socket.on("comm_playhead_moved_click_to_other_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_playhead_moved_click_to_other_server_to_client",data.locationByMeasure);
    })

    socket.on("comm_playhead_moved_partner_to_click_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_playhead_moved_partner_to_click_server_to_client",data.locationByMeasure);
    })

    socket.on("comm_region_selected_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_region_selected_server_to_client",data);
    })

    socket.on("comm_region_selected_partner_to_click_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_region_selected_partner_to_click_client_to_server",data);
    })

    socket.on("comm_BPM_changed_partner_to_click_client_to_server",data=>{
      socket.to(data.roomID).emit("comm_BPM_changed_partner_to_click_server_to_client",data.bpm);
    })

    socket.on("disconnect", () => {
      if (!roomIDglobal) return;

      const size = io.sockets.adapter.rooms.get(roomIDglobal)?.size ?? 0;

      io.in(roomIDglobal).emit("user_disconnected_server_to_client", size);
    });

  });

  return io;
};

module.exports = socketManager;