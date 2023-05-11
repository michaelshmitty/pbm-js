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

import PBM from "./src/pbm.js";

const thumbnailCanvas = document.getElementById("thumbnail-canvas");
const thumbnailContext = thumbnailCanvas.getContext("2d");
const imageCanvas = document.getElementById("image-canvas");
const imageContext = imageCanvas.getContext("2d");
const inputElement = document.getElementById("imagefile");
inputElement.addEventListener("change", handleFile, false);

fetch("/assets/TEST.LBM")
  .then((response) => {
    return response.arrayBuffer();
  })
  .then((buffer) => {
    const image = loadImage(buffer);
    drawImage(image.thumbnail, thumbnailContext);
    drawImage(image, imageContext);
  });

function handleFile() {
  const imageFile = this.files[0];
  const reader = new FileReader();

  reader.onload = (evt) => {
    const image = loadImage(evt.target.result);
    drawImage(image.thumbnail, thumbnailContext);
    drawImage(image, imageContext);
  };

  reader.readAsArrayBuffer(imageFile);
}

function loadImage(buffer) {
  const image = new PBM(buffer);
  thumbnailCanvas.width = image.thumbnail.width;
  thumbnailCanvas.height = image.thumbnail.height;
  imageCanvas.width = image.width;
  imageCanvas.height = image.height;

  return image;
}

function drawImage(image, context) {
  context.clearRect(0, 0, image.width, image.height);
  let pixels = context.createImageData(image.width, image.height);

  for (let x = 0; x < image.width; x++) {
    for (let y = 0; y < image.height; y++) {
      const index = y * image.width + x;
      const paletteIndex = image.pixelData[index];
      const pixelIndex = index * 4;

      const r = image.palette[paletteIndex][0];
      const g = image.palette[paletteIndex][1];
      const b = image.palette[paletteIndex][2];

      pixels.data[pixelIndex] = r;
      pixels.data[pixelIndex + 1] = g;
      pixels.data[pixelIndex + 2] = b;
      pixels.data[pixelIndex + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);
}
