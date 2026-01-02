const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const gameCanvas = document.getElementById("gameCanvas");
const gCtx = gameCanvas.getContext("2d");
const statusText = document.getElementById("status");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");

let bird = { x:50, y:200, w:30, h:30 };
let pipes = [];
let frame = 0;
let score = 0;
let gravity = 0.4;
let pipeSpeed = 2.5;
let timeLeft = 60;
let gameRunning = true;

// Previous face center for vertical movement
let prevFaceCenterY = null;

// Face info for side display
let faceBox = null;

// Pulsing pipe helper
function pulseColor(base, t){
  let p = Math.sin(t/300)*0.5 + 0.5;
  return base.map(c => Math.floor(c*p));
}

// Draw cute round bird
function drawBird() {
  gCtx.beginPath();
  gCtx.arc(bird.x + bird.w/2, bird.y + bird.h/2, bird.w/2, 0, Math.PI*2);
  const bodyGrad = gCtx.createRadialGradient(
    bird.x + bird.w/2, bird.y + bird.h/2, bird.w/4,
    bird.x + bird.w/2, bird.y + bird.h/2, bird.w/2
  );
  bodyGrad.addColorStop(0,"#fff200");
  bodyGrad.addColorStop(1,"#f9a602");
  gCtx.fillStyle = bodyGrad;
  gCtx.fill();
  gCtx.strokeStyle = "#f59e0b";
  gCtx.lineWidth = 2;
  gCtx.stroke();
  gCtx.closePath();

  // Eyes
  gCtx.fillStyle="black";
  gCtx.beginPath();
  gCtx.arc(bird.x + bird.w*0.3, bird.y + bird.h*0.35, 2, 0, Math.PI*2);
  gCtx.arc(bird.x + bird.w*0.7, bird.y + bird.h*0.35, 2, 0, Math.PI*2);
  gCtx.fill();

  // Beak
  gCtx.fillStyle="orange";
  gCtx.beginPath();
  gCtx.moveTo(bird.x + bird.w/2, bird.y + bird.h*0.5);
  gCtx.lineTo(bird.x + bird.w/2 +5, bird.y + bird.h*0.6);
  gCtx.lineTo(bird.x + bird.w/2 -5, bird.y + bird.h*0.6);
  gCtx.fill();
}

// Draw face box and stats on side with live video
function drawFaceInfo() {
  if(faceBox){
    const sideX = gameCanvas.width - faceBox.width - 20;
    const sideY = 20;

    // Draw semi-transparent background
    gCtx.fillStyle = "rgba(0,0,0,0.3)";
    gCtx.fillRect(sideX-5, sideY-5, faceBox.width+10, faceBox.height+90);

    // Draw the actual face from video
    gCtx.drawImage(
      video,
      faceBox.x, faceBox.y, faceBox.width, faceBox.height, // source from video
      sideX, sideY, faceBox.width, faceBox.height          // destination on canvas
    );

    // Draw rectangle over it
    gCtx.strokeStyle = "#ff0000";
    gCtx.lineWidth = 2;
    gCtx.strokeRect(sideX, sideY, faceBox.width, faceBox.height);

    // Display face width/height below the box
    gCtx.fillStyle = "#fff";
    gCtx.font = "16px Arial";
    gCtx.fillText(`Face W: ${Math.round(faceBox.width)}`, sideX, sideY + faceBox.height + 20);
    gCtx.fillText(`Face H: ${Math.round(faceBox.height)}`, sideX, sideY + faceBox.height + 40);

    // Display bird coordinates
    gCtx.fillText(`Bird X: ${Math.round(bird.x)}`, sideX, sideY + faceBox.height + 60);
    gCtx.fillText(`Bird Y: ${Math.round(bird.y)}`, sideX, sideY + faceBox.height + 80);
  }
}

// Draw background (sky gradient)
function drawBackground() {
  const grad = gCtx.createLinearGradient(0,0,0,gameCanvas.height);
  grad.addColorStop(0,"#87CEEB"); // sky blue
  grad.addColorStop(1,"#c0f0f9"); // lighter blue
  gCtx.fillStyle = grad;
  gCtx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
}

// Start game
async function startGame() {
  statusText.innerText = "Loading models...";
  await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models/');
  statusText.innerText = "Models loaded ✅";

  const stream = await navigator.mediaDevices.getUserMedia({ video:{} });
  video.srcObject = stream;

  video.onloadedmetadata = () => {
    video.play();
    overlay.width = gameCanvas.width = video.videoWidth;
    overlay.height = gameCanvas.height = video.videoHeight;

    const timerInterval = setInterval(() => {
      if(timeLeft>0){
        timeLeft--;
        timerEl.innerText = `Time Left: ${timeLeft}`;
      } else {
        gameRunning=false;
        clearInterval(timerInterval);
        alert(`Time's up! Final Score: ${score}`);
      }
    },1000);

    detectFace();
    gameLoop();
  };
}

// Face detection loop (vertical only)
async function detectFace() {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  async function run() {
    if(!gameRunning) return;

    const detections = await faceapi.detectAllFaces(video, options);
    if(detections.length > 0) {
      const box = detections[0].box;
      const scaleY = gameCanvas.height / video.videoHeight;
      const scaleX = gameCanvas.width / video.videoWidth;

      const faceCenterY = (box.y + box.height/2) * scaleY;

      // Relative vertical movement
      if(prevFaceCenterY !== null){
        let deltaY = faceCenterY - prevFaceCenterY;
        bird.y += deltaY * 1.5;
      }
      prevFaceCenterY = faceCenterY;

      // Clamp bird
      if(bird.y < 0) bird.y = 0;
      if(bird.y > gameCanvas.height - bird.h) bird.y = gameCanvas.height - bird.h;

      // Update face box for side display (scaled properly)
      faceBox = {
        x: box.x * scaleX,
        y: box.y * scaleY,
        width: box.width * scaleX,
        height: box.height * scaleY
      };
    }
    requestAnimationFrame(run);
  }
  run();
}

// Game loop
function gameLoop() {
  if(!gameRunning) return;

  drawBackground(); // draw sky
  bird.y += gravity*0.3;
  if(bird.y<0) bird.y=0;
  if(bird.y>gameCanvas.height-bird.h) bird.y=gameCanvas.height-bird.h;

  drawBird();
  drawFaceInfo();

  // Spawn pipes
  if(frame % 120 === 0){
    let gap = 120;
    let topHeight = Math.random()*(gameCanvas.height-gap-50)+50;
    pipes.push({x:gameCanvas.width, y:0, w:50, h:topHeight, scored:false});
    pipes.push({x:gameCanvas.width, y:topHeight+gap, w:50, h:gameCanvas.height-topHeight-gap, scored:false});
  }

  // Draw pipes & collisions
  pipes.forEach(p=>{
    p.x -= pipeSpeed;
    const color = pulseColor([0,255,0], Date.now());
    const pipeGrad = gCtx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);
    pipeGrad.addColorStop(0, `rgb(${color[0]},${color[1]},0)`);
    pipeGrad.addColorStop(1, `rgb(0,${color[1]},0)`);
    gCtx.fillStyle = pipeGrad;
    gCtx.fillRect(p.x,p.y,p.w,p.h);

    // Collision
    if(bird.x+bird.w>p.x && bird.x<p.x+p.w && bird.y+bird.h>p.y && bird.y<p.y+p.h){
      resetGame();
    }

    // Score
    if(!p.scored && p.y===0 && bird.x>p.x+p.w){
      score++;
      p.scored = true;
    }
  });

  pipes = pipes.filter(p=>p.x+p.w>0);

  scoreEl.innerText = `Score: ${score}`;
  frame++;
  requestAnimationFrame(gameLoop);
}

// Reset
function resetGame() {
  bird.y=200; bird.x=50; pipes=[]; score=0; timeLeft=60; gameRunning=true; prevFaceCenterY=null; faceBox=null;
  alert("Oops! You hit a pipe. Game restarted.");
}

// Start everything
startGame();
