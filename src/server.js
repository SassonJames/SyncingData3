const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');
const xxh = require('xxhashjs');

const walkImage = fs.readFileSync(`${__dirname}/../hosted/walk.png`);

const PORT = process.env.PORT || process.env.NODE_PORT || 3000;

const handler = (req, res) => {
  if (req.url === '/walk.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(walkImage);
  } else if (req.url === '/bundle.js') {
    fs.readFile(`${__dirname}/../hosted/bundle.js`, (err, data) => {
      // if err, throw it for now
      if (err) {
        throw err;
      }
      res.writeHead(200);
      res.end(data);
    });
  } else {
    fs.readFile(`${__dirname}/../hosted/index.html`, (err, data) => {
      // if err, throw it for now
      if (err) {
        throw err;
      }
      res.writeHead(200);
      res.end(data);
    });
  }
};

// start http server and get HTTP server instance
const app = http.createServer(handler);

const io = socketio(app);

// Applies gravity to clients
const GRAVITY = 3;

// start listening
app.listen(PORT);

// for each new socket connection
io.on('connection', (sock) => {
  const socket = sock;

  // app users in room1
  socket.join('room1');

  socket.square = {
    hash: xxh.h32(`${socket.id}${Date.now()}`, 0xDEADBEEF).toString(16),
    lastUpdate: new Date().getTime(), // last time this object was updated
    x: 0, // default x value of this square
    y: 0, // default y value of this square
    prevX: 0, // default y value of the last known position
    prevY: 0, // default x value of the last known position
    destX: 0, // default x value of the desired next x position
    destY: 0, // default y value of the desired next y position
    alpha: 0, // default alpha (how far this object is % from prev to dest)
    height: 121, // height of our sprites
    width: 61, // width of our sprites
    direction: 0,
    frame: 0, // which frame of animation we are on in the spritesheet
    frameCount: 0,
    moveLeft: false, // is user moving left
    moveRight: false, // is user moving right
    moveDown: false, // is user moving down
    moveUp: false, // is user moving up
  };

  socket.emit('joined', socket.square);

  // when we receive a movement update from the client
  socket.on('movementUpdate', (data) => {
    socket.square = data;
    socket.square.lastUpdate = new Date().getTime();
    socket.broadcast.to('room1').emit('updatedMovement', socket.square);
  });

  socket.on('calculateGravity', (data) => {
    const gravityMult = data.gravMult + 1;

    let gravApplied = gravityMult * GRAVITY;
    let squareDest = data.square.destY;

    if (gravApplied >= 15) {
      gravApplied = 15;
    }

    if (squareDest < 379) {
      squareDest += gravApplied;
      const message = {
        newDest: squareDest,
        gravMultiplier: gravityMult,
        falling: true,
      };
      socket.emit('gravUpdate', message);
    } else {
      squareDest = 379;
      const message = {
        newDest: squareDest,
        gravMultiplier: 0,
        falling: false,
      };
      socket.emit('gravUpdate', message);
    }
  });

  // when a user disconnects, we want to make sure we let everyone know
  // and ask them to remove the object
  socket.on('disconnect', () => {
    io.sockets.in('room1').emit('left', socket.square.hash);
    socket.leave('room1');
  });
});

const gravity = () => {
  io.sockets.in('room1').emit('gravityTick');
};

setInterval(gravity, 100);
