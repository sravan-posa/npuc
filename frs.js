const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");
const facesCountEl = document.getElementById("facesCount");

let trackedFaces = [];

// Resize canvas to match container
function resizeCanvas() {
  const container = video.parentElement;
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
}

// Start Face Recognition
async function startFRS() {
  statusText.innerText = "Loading models...";
  await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
  statusText.innerText = "Models loaded ✅ Starting camera...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      resizeCanvas();
      detectFacesLoop();
    };

    window.addEventListener('resize', resizeCanvas);

  } catch (err) {
    console.error(err);
    statusText.innerText = "Cannot access camera ❌";
  }
}

// Smooth interpolation
function lerp(a,b,t){return a+(b-a)*t;}

// Face Detection Loop
async function detectFacesLoop() {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });

  async function run() {
    const detections = await faceapi.detectAllFaces(video, options);

    ctx.clearRect(0,0,canvas.width,canvas.height);

    trackedFaces.forEach(f=>f.matched=false);

    detections.forEach(det => {
      const box = det.box;
      const x=box.x, y=box.y, w=box.width, h=box.height;

      let closest=null, minDist=Infinity;
      trackedFaces.forEach(tf=>{
        const dx=(x+w/2)-(tf.x+tf.w/2);
        const dy=(y+h/2)-(tf.y+tf.h/2);
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<50 && dist<minDist){ minDist=dist; closest=tf; }
      });

      if(closest){
        closest.x=lerp(closest.x,x,0.25);
        closest.y=lerp(closest.y,y,0.25);
        closest.w=lerp(closest.w,w,0.25);
        closest.h=lerp(closest.h,h,0.25);
        closest.matched=true;
      } else {
        trackedFaces.push({x,y,w,h,matched:true});
      }
    });

    trackedFaces = trackedFaces.filter(f=>f.matched);

    // Scale to container
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    trackedFaces.forEach(f => {
      const x = f.x * scaleX;
      const y = f.y * scaleY;
      const w = f.w * scaleX;
      const h = f.h * scaleY;

      // Simple neon box
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Width & height
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x, y-18, w, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`W:${Math.round(f.w)}`, x+4, y-5);
      ctx.textAlign = "right";
      ctx.fillText(`H:${Math.round(f.h)}`, x+w-4, y-5);
    });

    facesCountEl.innerText = `Faces Detected: ${trackedFaces.length}`;

    requestAnimationFrame(run);
  }
  run();
}

// Start everything
startFRS();
