import {connection, server as WebSocketServer} from 'websocket';
import http from 'http';
import { log } from 'console';
import { OutgoingMessage, SupportedMessage as OutgoingSupportMessages } from './messages/outgoingMessages';
import { InMemoryStore } from './store/InMemoryStore';
import { UserManager } from './UserManager';
import { IncomingMessage, SupportedMessage } from './messages/incomingMessages';
import { disconnect } from 'process';

const server = http.createServer(function(request: any, response: any) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

const userManager = new UserManager();
const store = new InMemoryStore();

server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

const wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

function originIsAllowed(origin: string) {
  return true;
}

wsServer.on('request', function(request) {
    console.log("inside connect");
    
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    
    var connection = request.accept(null, request.origin);
    console.log((new Date()) + ' Connection accepted.');

    connection.on('message', function(message) {

        if (message.type === 'utf8') {
            try {
                messageHandler(connection, JSON.parse(message.utf8Data))
            } catch(e) {

            }
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        // userManager.removeUser(roomId, userId);
    });
});

function messageHandler(ws: connection, message: IncomingMessage){
    if(message.type == SupportedMessage.JoinRoom) {
        const payload = message.payload;
        userManager.addUser(payload.name, payload.userId, payload.roomId, ws)
    }

    if(message.type === SupportedMessage.SendMessage){
        const payload = message.payload;
        const user = userManager.getUser(payload.roomId, payload.userId);

        if(!user){
            console.error("User not found in the db");
            return; 
        }

        let chat = store.addChat(payload.userId, user.name, payload.roomId, payload.message);
        if(!chat){
            return;
        }

        const outgoingPayload: OutgoingMessage = {
            type: OutgoingSupportMessages.AddChat,
            payload:{
                chatId: chat.id,
                roomId: payload.roomId,
                message: payload.message,
                name: user.name,
                upvotes: 0
            }
        }
        userManager.broadcast(payload.roomId, payload.userId, outgoingPayload);
    }
    if(message.type === SupportedMessage.UpvoteMessage) {
        const payload = message.payload;
        const chat = store.upvote(payload.userId, payload.roomId, payload.chatId);

        if(!chat) {
            return;
        }

        const outgoingPayload: OutgoingMessage= {
            type: OutgoingSupportMessages.UpdateChat,
            payload: {
                chatId: payload.chatId,
                roomId: payload.roomId,
                upvotes: chat.upvotes.length    
            }
        }
        console.log("inside upvote 3")
        userManager.broadcast(payload.roomId, payload.userId, outgoingPayload)
    }
}