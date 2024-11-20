import http from "http";
import express from "express";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

function generateMeetingCode() {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 10; i++) {
        const randomInd = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomInd);
    }
    return result;
}

const users = [];
const rooms = new Map();

function createRoom(user, meetingCode) {
    const roomExists = rooms.has(meetingCode);
    const existingRoom = rooms.get(meetingCode);

    if (roomExists) {
        if (isRoomFull(meetingCode)) {
            user.socket.emit("room-full", { message: "This room is already full. Please try another." });
            return null;
        } else {
            if (existingRoom.user1) {
                existingRoom.user2 = user;
            } else {
                existingRoom.user1 = user;
            }
            rooms.set(meetingCode, existingRoom);
            return existingRoom;
        }
    } else {
        const newRoom = { user1: user, user2: null };
        rooms.set(meetingCode, newRoom);
        return newRoom;
    }
}

function getRoomByCode(meetingCode) {
    return rooms.get(meetingCode);
}

function isRoomFull(meetingCode) {
    const room = rooms.get(meetingCode);
    return room && room.user1 !== null && room.user2 !== null;
}

function addUser(name, socket, meetingCode) {
    const user = { name, socket };
    users.push(user);

    const room = getRoomByCode(meetingCode);
    if (room) {
        if (isRoomFull(meetingCode)) {
            socket.emit("room-full", { message: "This room is already full. Please try another." });
            return null;
        }
        room.user2 = user;
        createRoom(room.user1, meetingCode);
    } else {
        createRoom(user, meetingCode);
    }

    socket.emit("joined-room", { meetingCode });
}

function removeUser(socketId) {
    users = users.filter(user => user.socket.id !== socketId);
}

io.setMaxListeners(20);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', ({ username }) => {
        const meetingCode = generateMeetingCode();
        const user = { name: username, socket };
        const room = createRoom(user, meetingCode);

        if (room) {
            socket.emit("meeting-created", { meetingCode });
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
        addUser(username, socket, meetingCode);
        const room = getRoomByCode(meetingCode);

        if (room && room.user1 && room.user2) {
            room.user1.socket.emit("send-offer", { meetingCode });
            room.user2.socket.emit("send-offer", { meetingCode });
        } else {
            console.log("Failed to join room");
        }
    });

    // Set up event listeners for WebRTC signaling
    socket.on("offer", ({ sdp, meetingCode }) => {
        console.log("offering")
        const room = getRoomByCode(meetingCode);
        if (!room) return;

        const receivingUser = room.user1.socket.id === socket.id ? room.user2 : room.user1;
        if (receivingUser) {
            receivingUser.socket.emit("offer", { sdp, meetingCode });
            console.log("Offer sent to peer.");
        }
    });

    socket.on("answer", ({ sdp, meetingCode }) => {
        console.log("answering");
        const room = getRoomByCode(meetingCode);
        if (!room) return;

        const receivingUser = room.user1.socket.id === socket.id ? room.user2 : room.user1;
        if (receivingUser) {
            receivingUser.socket.emit("answer", { sdp, meetingCode });
            console.log("Answer sent to peer.");
        }
    });

    socket.on("add-ice-candidate", ({ candidate, meetingCode, type }) => {
        console.log("Adding ICE candidate");
        const room = getRoomByCode(meetingCode);
        if (!room) return;
    
        const receivingUser = room.user1.socket.id === socket.id ? room.user2 : room.user1;
        if (receivingUser) {
            receivingUser.socket.emit("add-ice-candidate", { candidate, type });
            console.log("ICE candidate sent to peer.");
        }
    });
    

    // Handle user disconnection
    socket.on("disconnect", () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
