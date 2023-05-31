/*

  MIT License

  Copyright (c) 2023 Michael Smith <root@retrospace.be>

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

import parsePBM from "./src/pbm.js";

const thumbnailCanvas = document.getElementById("thumbnail-canvas");
const thumbnailContext = thumbnailCanvas.getContext("2d");
const imageCanvas = document.getElementById("image-canvas");
const imageContext = imageCanvas.getContext("2d");
const paletteCanvas = document.getElementById("palette-canvas");
const paletteContext = paletteCanvas.getContext("2d");

let currentPalettePage = 0;
let image = null;
let running = false;

let cycleSpeed = 15.0;

// Drawing
function drawPalette() {
  const colorSize = 20; // in pixels
  const width = 4 * colorSize; // 4 columns
  const height = 16 * colorSize; // 16 rows

  paletteCanvas.width = width;
  paletteCanvas.height = height;

  paletteContext.clearRect(0, 0, width, height);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 4; x++) {
      const index = currentPalettePage * 64 + (y * 4 + x);

      const color = `rgb(${image.palette[index][0]}, ${image.palette[index][1]}, ${image.palette[index][2]})`;
      paletteContext.fillStyle = color;

      paletteContext.fillRect(x * colorSize, y * colorSize, width, height);
    }
  }
}

function drawImage(anImage, ctx) {
  ctx.clearRect(0, 0, anImage.width, anImage.height);
  const pixels = ctx.createImageData(anImage.width, anImage.height);

  for (let x = 0; x < anImage.width; x++) {
    for (let y = 0; y < anImage.height; y++) {
      const index = y * anImage.width + x;
      const paletteIndex = anImage.pixelData[index];
      const pixelIndex = index * 4;

      const r = anImage.palette[paletteIndex][0];
      const g = anImage.palette[paletteIndex][1];
      const b = anImage.palette[paletteIndex][2];

      pixels.data[pixelIndex] = r;
      pixels.data[pixelIndex + 1] = g;
      pixels.data[pixelIndex + 2] = b;
      pixels.data[pixelIndex + 3] = 255;
    }
  }

  ctx.putImageData(pixels, 0, 0);
}

// Image loading
function loadImage(buffer) {
  image = parsePBM(buffer);
  thumbnailCanvas.width = image.thumbnail.width;
  thumbnailCanvas.height = image.thumbnail.height;
  imageCanvas.width = image.width;
  imageCanvas.height = image.height;

  return image;
}

document.getElementById("imagefile").addEventListener(
  "change",
  (e) => {
    const imageFile = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (evt) => {
      image = loadImage(evt.target.result);
      drawPalette(image.palette, currentPalettePage, paletteContext);
      drawImage(image.thumbnail, thumbnailContext);
      drawImage(image, imageContext);
    };

    reader.readAsArrayBuffer(imageFile);
  },
  false
);

// Palette navigation
document.getElementById("paletteLeft").addEventListener("click", () => {
  if (currentPalettePage === 0) {
    currentPalettePage = 3;
  } else {
    currentPalettePage -= 1;
  }
  document.getElementById("palettePageLabel").innerText =
    currentPalettePage + 1;
  drawPalette();
});

document.getElementById("paletteRight").addEventListener("click", () => {
  if (currentPalettePage === 3) {
    currentPalettePage = 0;
  } else {
    currentPalettePage += 1;
  }
  document.getElementById("palettePageLabel").innerText =
    currentPalettePage + 1;
  drawPalette();
});

// Color cycling
function cycleColors(now) {
  image.cyclingRanges.forEach((range) => {
    if (range.active) {
      if (!range.lastTime) range.lastTime = now;

      if (now - range.lastTime > range.rate / cycleSpeed) {
        if (range.direction === "forward") {
          // Move last color to first position
          const lastColor = image.palette.splice(range.high, 1)[0];
          image.palette.splice(range.low, 0, lastColor);
        } else if (range.direction === "reverse") {
          // Move first color to last position
          const firstColor = image.palette.splice(range.low, 1)[0];
          image.palette.splice(range.high, 0, firstColor);
        }
        range.lastTime = now;
      }
    }
  });
}

function animate(now) {
  cycleColors(now);
  drawPalette();
  drawImage(image, imageContext);

  if (running) requestAnimationFrame(animate);
}

document
  .getElementById("cyclingSpeedSlider")
  .addEventListener("input", (evt) => {
    cycleSpeed = evt.target.value;
    document.getElementById("cyclingSpeedLabel").innerText = cycleSpeed;
  });

document.getElementById("cycleColors").addEventListener("click", () => {
  if (running) {
    running = false;
  } else {
    running = true;
    animate();
  }
});
