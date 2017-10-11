const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read the client html file into memory
const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html'});
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

// io Server
const io = socketio(app);

// keep track of users squares
usersquares = {};

io.on('connection', (socket) => {
   // Join the Room
   socket.join('room1');
    
    socket.on("join", (data) => {
       socket.color = data.color; 
       usersquares[data.color] = data;
       io.sockets.in('room1').emit('updateDraw', usersquares);
    });
   
   // When they update their square's position, redraw it
   socket.on('newsquare', (data) => {
        usersquares[data.color].x = data.x;
        usersquares[data.color].y = data.y;
        io.sockets.in('room1').emit('updateDraw', usersquares);
      
   });
   
   // When they disconnect, leave the room
   socket.on('disconnect', () => {
      socket.leave('room1'); 
      delete usersquares[socket.color];
       io.sockets.in('room1').emit('updateDraw', usersquares);
   });
    
    // broadcast the current drawstack
    socket.emit('updateDraw', usersquares);
});