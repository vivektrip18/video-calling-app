import { Socket } from "socket.io";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import { UserManager } from "./managers/UserManager.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
}));

function generateMeetingCode() {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 10; i++) {
        const randomInd = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomInd);
    }
    return result;
}
const userManager = new UserManager();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ username }) => {
        const meetingCode = generateMeetingCode();
        const user = { name: username, socket };
        const room = userManager.roomManager.createRoom(user, meetingCode);

        if (room) {
            socket.emit("meeting-created", { meetingCode, roomId: room.roomId });
        } else {
            console.log("Failed to create room");
        }
    });

    socket.on("join-room", (data) => {
        if (!data || !data.username || !data.meetingCode) {
            console.log("Failed to join room: Invalid data", data);
            return;
        }
        const { username, meetingCode } = data;
        const user = { username, socket };
        userManager.addUser(username, socket, meetingCode);
        const room = userManager.roomManager.getRoomByCode(meetingCode);

        if (room && room.user1 && room.user2) {
            room.user1.socket.emit("send-offer", { meetingCode, roomId: room.roomId });
            room.user2.socket.emit("send-offer", { meetingCode, roomId: room.roomId });

        }
        else if(room){
            socket.emit("meeting-joined", { meetingCode, roomId: room.roomId });

        } 
        else {
            console.log("Failed to join room");
        }
    });

    
});


server.listen(3000, () => {
    console.log('server runnning on http://localhost:3000');
})