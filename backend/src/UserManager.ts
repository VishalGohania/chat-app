import { connection } from "websocket";
import { OutgoingMessage } from "./messages/outgoingMessages";


interface User {
  name: string,
  id: string,
  conn: connection
}

interface Room {
  users: User[]
}

export class UserManager {
  private rooms: Map<string, Room>;
  constructor() {
    this.rooms = new Map<string, Room>()
  }

  addUser(name: string, userId: string, roomId: string, socket: connection){
    if(!this.rooms.get(roomId)){
      this.rooms.set(roomId, {
        users: []
      })
    }
    
    const existingUser = this.getUser(roomId, userId);
    if(existingUser) {
      console.log(`User with id ${userId} already exists in the room!`);
      return;
    }

    this.rooms.get(roomId)?.users.push({
      id: userId,
      name,
      conn: socket
    })
    socket.on('close', (reasonCode, description) => {
      this.removeUser(roomId, userId);
    });
  }

  private getUserByConnection(conn: connection): { roomId: string, userId: string } | null {
    for (const [roomId, room] of this.rooms) {
      const user = room.users.find(user => user.conn === conn);
      if (user) {
        return { roomId, userId: user.id };
      }
    }
    return null;
  }

  removeUser(roomId: string, userId: string) {
    console.log("removed user");
    const room = this.rooms.get(roomId);
    if(room) {
      room.users = room.users.filter(({id}) => id !== userId);
      console.log(`User with id ${userId} removed!`);
    } else {
      console.error(`Error occurred while removing user with id ${userId}`)
    }
  }

  removeUserByConnection(conn: connection) {
    const userInfo = this.getUserByConnection(conn);
    if (userInfo) {
      this.removeUser(userInfo.roomId, userInfo.userId);
    }
  }

  getUser(roomId: string, userId: string): User | null {
    const user = this.rooms.get(roomId)?.users.find((({id}) => id === userId));
    return user ?? null; 
  }

  broadcast(roomId: string, userId: string, message: OutgoingMessage) {
    const user = this.getUser(roomId, userId);
    if(!user){
      console.error("User not found")
      return;
    }

    const room = this.rooms.get(roomId);
    if(!room){
      console.error("Room not found");
      return;
    }

    room.users.forEach(({conn, id}) => {
      if(id === userId){
        return;
      }
      console.log("outgoing message" + JSON.stringify(message))
      conn.sendUTF(JSON.stringify(message))
    })
  }
}