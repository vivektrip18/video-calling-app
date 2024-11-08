import { RoomManager } from "./RoomManager.js";

export class UserManager {
    constructor() {
        this.users = [];
        this.roomManager = new RoomManager();
    }

    addUser(name, socket, meetingCode) {
        const user = { name, socket };
        this.users.push(user); 

        const room = this.roomManager.getRoomByCode(meetingCode);
        if (room) {
            if (this.roomManager.isRoomFull(meetingCode)) {
                socket.emit("room-full", { message: "This room is already full. Please try another." });
                return; 
            }

            room.user2 = user;
            this.roomManager.createRoom(room.user1, room.user2, meetingCode);
        } else {
            this.roomManager.createRoom(user, null, meetingCode);
        }

        this.initHandlers(socket, meetingCode);
        socket.emit("joined-room", { meetingCode });
    }

    removeUser(socketId) {
        this.users = this.users.filter(user => user.socket.id !== socketId);
    }

    initHandlers(socket, meetingCode) {
        socket.on("offer", ({ sdp }) => {
            this.roomManager.onOffer(meetingCode, sdp, socket.id);
        });

        socket.on("answer", ({ sdp }) => {
            this.roomManager.onAnswer(meetingCode, sdp, socket.id);
        });

        socket.on("add-ice-candidate", ({ candidate, type }) => {
            this.roomManager.onIceCandidates(meetingCode, socket.id, candidate, type);
        });
    }
}

