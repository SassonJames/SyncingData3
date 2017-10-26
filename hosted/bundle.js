"use strict";

let canvas;
let ctx;
let walkImage;

//our websocket connection
let socket; //this user's socket
let hash; //this user's personal object id

let isFalling; //variable to keep track if player in air **PREVENTS DOUBLE JUMP**
let currentGrav; //keeps track of acceleration of gravity

//directional constants for which directions a user sprite could be facing.
const directions = {
  DOWNLEFT: 0,
  DOWN: 1,
  DOWNRIGHT: 2, 
  LEFT: 3,
  UPLEFT: 4,
  RIGHT: 5, 
  UPRIGHT: 6,
  UP: 7
};

//object to hold all of our squares
//These will be all of our user's objects
let squares = {};

//function to update a square 
//(single square sent from the server)
const update = (data) => {
  if(!squares[data.hash]) {
	squares[data.hash] = data;
	return;
  }
  
  const square = squares[data.hash]; 

  if(squares[data.hash].lastUpdate >= data.lastUpdate) {
	return;
  }

  //overwrite our lastUpdate with the one from the object
  square.lastUpdate = data.lastUpdate;

  square.prevX = data.prevX;
  square.prevY = data.prevY;
  square.destX = data.destX;
  square.destY = data.destY;

  square.alpha = 0;
  
  square.direction = data.direction;
  square.moveLeft = data.moveLeft;
  square.moveRight = data.moveRight;
  square.moveDown = data.moveDown;
  square.moveUp = data.moveUp;
};

//remove a user object by the object's id
//id is the hash from the server of an object
const removeUser = (hash) => {
  //if we have that object
  if(squares[hash]) {
	//delete it from our squares object
	delete squares[hash];
  }
};

//set this user's object from the server
//data will be this user's object
const setUser = (data) => {
  hash = data.hash;
  squares[hash] = data;
    
  //redraw with our latest info
  requestAnimationFrame(redraw);
};

/**
  linear interpolation (lerp) function
  This will calculate how far a number should be
  based on position 1 (v0), position 2 (v1) and
  how far between in % it is (alpha).
  
  An alpha of 0 is at the previous position (A)
  An alpha of 1 is at the destination position (B)
  An alpha of 0.5 is halfway between A and B.
**/
const lerp = (v0, v1, alpha) => {
  return (1 - alpha) * v0 + alpha * v1;
};

//update this user's position
const updatePosition = () => {
  const square = squares[hash];

  //set our user's previous positions to their last positions
  square.prevX = square.x;
  square.prevY = square.y;
  
  //if the user is going left but not off screen
  //move their destination left (so we can animate)
  //from our current x
  if(square.moveLeft && square.destX > 0) {
	square.destX -= 2;
  }
  
  //if the user is moving right but not off screen
  //move their destination right (so we can animate)
  //from our current x
  if(square.moveRight && square.destX < 439) {
	square.destX += 2;
  }

  //if user is just moving down
  if(square.moveDown && !(square.moveRight || square.moveLeft)) square.direction = directions.DOWN;

  //if user is just moving up
  if(square.moveUp && !(square.moveRight || square.moveLeft)) square.direction = directions.UP;

  //if user is just moving left
  if(square.moveLeft && !(square.moveUp || square.moveDown)) square.direction = directions.LEFT;

  //if user is just moving right
  if(square.moveRight && !(square.moveUp || square.moveDown)) square.direction = directions.RIGHT;
  
  //reset our alpha since we are moving
  //want to reset the animation to keep playing
  square.alpha = 0;
    
  socket.emit('movementUpdate', square);
};

//redraw our player objects (requestAnimationFrame)
const redraw = (time) => {
  //update our current user's position
  updatePosition();

  //clear screen
  ctx.clearRect(0, 0, 500, 500);

  const keys = Object.keys(squares);

  //for each key in squares
  for(let i = 0; i < keys.length; i++) {

	//grab the square by user id (from our keys)
	const square = squares[keys[i]];

	if(square.alpha < 1) square.alpha += 0.05;

	if(square.hash === hash) {
	  ctx.filter = "none"
	}
	else {
	  ctx.filter = "hue-rotate(40deg)";
	}

	square.x = lerp(square.prevX, square.destX, square.alpha);
	square.y = lerp(square.prevY, square.destY, square.alpha);

	if(square.frame > 0 || (square.moveUp || square.moveDown || square.moveRight || square.moveLeft)) {
	  //start increasing our frame counter
	  //We DON'T want to switch to the next sprite in the spritesheet
	  //every frame. At 60fps that would be flicker. 
	  //Instead when our frame counter reaches 8 (every 8 frames)
	  //we will switch to the next sprite in the spritesheet animation.
	  //The number 8 is arbitrary. It looked decent, but you could increase
	  //the frameCount or lower it.
	  square.frameCount++;

	  //if our framecount reaches our max,
	  //meaning we drew the same sprite that many times,
	  //then it is time to switch to the next sprite in the animation.
	  if(square.frameCount % 8 === 0) {
		//since the images in this spritesheet have 8 frames each
		//starting at 0, we want to make sure the animation loops
		//back around.
		
		//if we have a next image in our spritesheet animation
		//then increase until we hit the limit
		//If we do reach the limit, then loop back around to the
		//beginning of the spritesheet animation to play again.
		if(square.frame < 7) {
		  square.frame++;
		} else {
		  square.frame = 0;
		}
	  }
	}

	ctx.drawImage(
	  walkImage,  
	  square.width * square.frame,
	  square.height * square.direction,
	  square.width,
	  square.height,
	  square.x,
	  square.y,
	  square.width,
	  square.height, 
	);
	
	ctx.strokeRect(square.x, square.y, square.width, square.height);
  }

  //redraw (hopefully at 60fps)
  requestAnimationFrame(redraw);
};

//handle key down
const keyDownHandler = (e) => {
	//grab keycode from keyboard event
	var keyPressed = e.which;
	
	//grab this user's object 
	const square = squares[hash];
  
	// A OR LEFT
	if(keyPressed === 65 || keyPressed === 37) {
	  square.moveLeft = true;
	}
    
	// D OR RIGHT
	else if(keyPressed === 68 || keyPressed === 39) {
	  square.moveRight = true;
	}
    
    // SPACE to JUMP
    else if(keyPressed === 32 && isFalling === false){
        square.destY -= 75;
        isFalling = true;
	}   
  
	//if one of these keys is down, let's cancel the browsers
	//default action so the page doesn't try to scroll on the user
	if(square.moveUp || square.moveDown || square.moveLeft || square.moveRight) {
	  e.preventDefault();
	}
};

//key up event
const keyUpHandler = (e) => {
	//grab keycode from keyboard event
	var keyPressed = e.which;
  
	//grab this user's object
	const square = squares[hash];

	// A OR LEFT
	if(keyPressed === 65 || keyPressed === 37) {
	  square.moveLeft = false;
	}

	// D OR RIGHT
	else if(keyPressed === 68 || keyPressed === 39) {
	  square.moveRight = false;
    }    
};

const applyGravity = (gravLevel) => {
    const square = squares[hash];
    currentGrav += gravLevel;
    if(currentGrav >= 15){
        currentGrav = 15;
    }
    
    if(square.destY < 379){
        square.destY += currentGrav;
    }
    else{
        square.destY == 379;
        currentGrav = 0;
        isFalling = false;
    }
};

const init = () => {
	walkImage = document.querySelector('#walk');
	canvas = document.querySelector('#canvas');
	ctx = canvas.getContext('2d');
    
    isFalling = true;
    currentGrav = 0;

	socket = io.connect();
	
	socket.on('connect', function () {
	});  
	
	//when the socket receives a 'joined'
	//event from the server, call setUser
	socket.on('joined', setUser);
	
	//when the socket receives an   'updatedMovement'
	//event from the server, call update
	socket.on('updatedMovement', update);
	
	//when the socket receives a 'left'
	//event from the server, call removeUser
	socket.on('left', removeUser);
    
    //when recieving a gravity update from the server
    //apply gravity to the user
    socket.on('gravityTick', function(data){
        applyGravity(data);
    });
  
	//key listeners
	document.body.addEventListener('keydown', keyDownHandler);
	document.body.addEventListener('keyup', keyUpHandler);
};

window.onload = init;