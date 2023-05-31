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

import BinaryStream from "./binarystream.js";

function decompress(binaryStream, length) {
  const result = [];
  const endOfChunkIndex = binaryStream.index + length;

  while (binaryStream.index < endOfChunkIndex) {
    const byte = binaryStream.readByte();

    if (byte > 128) {
      const nextByte = binaryStream.readByte();
      for (let i = 0; i < 257 - byte; i++) {
        result.push(nextByte);
      }
    } else if (byte < 128) {
      for (let i = 0; i < byte + 1; i++) {
        result.push(binaryStream.readByte());
      }
    } else {
      break;
    }
  }

  return result;
}

// Parse Bitmap Header chunk
function parseBMHD(binaryStream, image) {
  image.width = binaryStream.readUint16BE();
  image.height = binaryStream.readUint16BE();
  image.size = image.width * image.height;
  image.xOrigin = binaryStream.readInt16BE();
  image.yOrigin = binaryStream.readInt16BE();
  image.numPlanes = binaryStream.readUint8();
  image.mask = binaryStream.readUint8();
  image.compression = binaryStream.readUint8();
  binaryStream.readUint8(); // Ignore pad1 field left "for future compatibility"
  image.transClr = binaryStream.readUint16BE();
  image.xAspect = binaryStream.readUint8();
  image.yAspect = binaryStream.readUint8();
  image.pageWidth = binaryStream.readInt16BE();
  image.pageHeight = binaryStream.readInt16BE();
}

// Parse Palette chunk
function parseCMAP(binaryStream, numPlanes) {
  const palette = [];
  const numColors = 2 ** numPlanes;

  // TODO(m): Read 3 bytes at a time?
  for (let i = 0; i < numColors; i++) {
    const rgb = [];
    for (let j = 0; j < 3; j++) {
      rgb.push(binaryStream.readByte());
    }
    palette.push(rgb);
  }

  return palette;
}

// Parse Color range chunk
function parseCRNG(binaryStream) {
  binaryStream.jump(2); // 2 bytes padding according to https://en.wikipedia.org/wiki/ILBM#CRNG:_Colour_range

  const rate = binaryStream.readInt16BE();
  const flags = binaryStream.readInt16BE();
  const low = binaryStream.readUint8();
  const high = binaryStream.readUint8();

  // Parse flags according to https://en.wikipedia.org/wiki/ILBM#CRNG:_Colour_range
  // If bit 0 is 1, the color should cycle, otherwise this color register range is inactive
  // and should have no effect.
  //
  // If bit 1 is 0, the colors cycle upwards (forward), i.e. each color moves into the next
  // index position in the palette and the uppermost color in the range moves down to the
  // lowest position.
  // If bit 1 is 1, the colors cycle in the opposite direction (reverse).
  // Only those colors between the low and high entries in the palette should cycle.
  const activeBitMask = 1 << 0;
  const directionBitMask = 1 << 1;

  return {
    rate,
    active: (flags & activeBitMask) !== 0,
    direction: (flags & directionBitMask) !== 0 ? "reverse" : "forward",
    low,
    high,
  };
}

// Parse Thumbnail chunk
function parseTINY(binaryStream, compression, chunkLength) {
  const thumbnail = {};

  thumbnail.width = binaryStream.readUint16BE();
  thumbnail.height = binaryStream.readUint16BE();
  thumbnail.size = thumbnail.width * thumbnail.height;

  if (compression === 1) {
    thumbnail.pixelData = decompress(binaryStream, chunkLength - 4);
  } else {
    thumbnail.pixelData = binaryStream.readBytes(chunkLength);
  }

  return thumbnail;
}

// Parse Image data chunk
function parseBODY(binaryStream, compression, chunkLength) {
  if (compression === 1) {
    return decompress(binaryStream, chunkLength);
  }

  return binaryStream.readBytes(chunkLength);
}

// Parse FORM chunk
function parseFORM(binaryStream, image) {
  let chunkId = binaryStream.readString(4);
  let chunkLength = binaryStream.readUint32BE();
  const formatId = binaryStream.readString(4);

  // Validate chunk according to notes on https://en.wikipedia.org/wiki/ILBM
  if (chunkId !== "FORM") {
    throw new Error(
      `Invalid chunkId: "${chunkId}" at byte ${binaryStream.index}. Expected "FORM".`
    );
  }

  if (chunkLength !== binaryStream.length - 8) {
    throw new Error(
      `Invalid chunk length: ${chunkLength} bytes. Expected ${
        binaryStream.length - 8
      } bytes.`
    );
  }

  if (formatId !== "PBM ") {
    throw new Error(`Invalid formatId: "${formatId}". Expected "PBM ".`);
  }

  // Parse all other chunks
  while (!binaryStream.EOF()) {
    chunkId = binaryStream.readString(4);
    chunkLength = binaryStream.readUint32BE();

    switch (chunkId) {
      case "BMHD":
        parseBMHD(binaryStream, image);
        break;
      case "CMAP":
        image.palette = parseCMAP(binaryStream, image.numPlanes);
        break;
      case "DPPS":
        // NOTE(m): Ignore unknown DPPS chunk of size 110 bytes
        binaryStream.jump(110);
        break;
      case "CRNG":
        image.cyclingRanges.push(parseCRNG(binaryStream));
        break;
      case "TINY":
        image.thumbnail = parseTINY(
          binaryStream,
          image.compression,
          chunkLength
        );

        // FIXME(m): Remove need for reference to image palette in thumbnail data
        image.thumbnail.palette = image.palette;
        break;
      case "BODY":
        image.pixelData = parseBODY(
          binaryStream,
          image.compression,
          chunkLength
        );
        break;
      default:
        throw new Error(
          `Unsupported chunkId: ${chunkId} at byte ${binaryStream.index}`
        );
    }

    // Skip chunk padding byte when chunkLength is not a multiple of 2
    if (chunkLength % 2 === 1) binaryStream.jump(1);
  }
}

export default function parsePBM(arrayBuffer) {
  const binaryStream = new BinaryStream(arrayBuffer);
  const image = {
    cyclingRanges: [],
  };

  try {
    parseFORM(binaryStream, image);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error(`Failed to parse file.`);
    } else {
      throw error; // re-throw the error unchanged
    }
  }

  return image;
}
