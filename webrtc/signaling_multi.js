/*
The MIT License (MIT)

Copyright (c) 2016 mganeko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

"use strict";

// Please install socket.io module
//   npm install socket.io
//
// Run
//   node signaling_room.js



/*--
let WebSocketServer = require('ws').Server;
let port = 3001;
let wsServer = new WebSocketServer({ port: port });
console.log('websocket server start. port=' + port);
wsServer.on('connection', function(ws) {
  console.log('-- websocket connected --');
  ws.on('message', function(message) {
    wsServer.clients.forEach(function each(client) {
      if (isSame(ws, client)) {
        console.log('- skip sender -');
      }
      else {
        client.send(message);
      }
    });
  });
});
function isSame(ws1, ws2) {
  // -- compare object --
  return (ws1 === ws2);     
  // -- compare undocumented id --
  //return (ws1._ultron.id === ws2._ultron.id);
}
--*/


var srv = require('http').Server();
var io = require('socket.io')(srv);
var port = 3002;
srv.listen(port);
console.log('signaling server started on port:' + port);


// This callback function is called every time a socket
// tries to connect to the server
io.on('connection', function(socket) {
    // ---- multi room ----
    socket.on('enter', function(roomname) {
      socket.join(roomname);
      console.log('id=' + socket.id + ' enter room=' + roomname);
      setRoomname(roomname);
    });

    function setRoomname(room) {
      socket.roomname = room;
    }

    function getRoomname() {
      var room = socket.roomname;
      return room;
    }

    function emitMessage(type, message) {
      // ----- multi room ----
      var roomname = getRoomname();

      if (roomname) {
        console.log('===== message broadcast to room -->' + roomname);
        socket.broadcast.to(roomname).emit(type, message);
      }
      else {
        console.log('===== message broadcast all');
        socket.broadcast.emit(type, message);
      }
    }

    // When a user send a SDP message
    // broadcast to all users in the room
    socket.on('message', function(message) {
        var date = new Date();
        message.from = socket.id;
        console.log(date + 'id=' + socket.id + ' Received Message: ' + JSON.stringify(message));

        // get send target
        var target = message.sendto;
        if (target) {
          console.log('===== message emit to -->' + target);
          socket.to(target).emit('message', message);
          return;
        }

        // broadcast in room
        emitMessage('message', message);
    });

    // When the user hangs up
    // broadcast bye signal to all users in the room
    socket.on('disconnect', function() {
        // close user connection
        console.log((new Date()) + ' Peer disconnected. id=' + socket.id);

        // --- emit ----
        emitMessage('user disconnected', {id: socket.id});

        // --- leave room --
        var roomname = getRoomname();
        if (roomname) {
          socket.leave(roomname);
        }
    });

});