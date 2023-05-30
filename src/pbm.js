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

class PBM {
  constructor(arrayBuffer) {
    this.binaryStream = new BinaryStream(arrayBuffer);

    // Image properties taken from BMHD chunk
    this.width = null;
    this.height = null;
    this.size = null;
    this.xOrigin = null;
    this.yOrigin = null;
    this.numPlanes = null;
    this.mask = null;
    this.compression = null;
    this.transClr = null;
    this.xAspect = null;
    this.yAspect = null;
    this.pageWidth = null;
    this.pageHeight = null;

    // Palette information taken from CMAP chunk
    this.palette = [];

    // Color cycling information taken from CRNG chunk
    this.cyclingRanges = [];

    // Thumbnail information taken from TINY chunk
    this.thumbnail = {
      width: null,
      height: null,
      size: null,
      palette: this.palette,
      pixelData: [],
    };

    // Uncompressed pixel data referencing palette colors
    this.pixelData = [];

    try {
      this.parseFORM();
    } catch (error) {
      if (error instanceof RangeError) {
        throw new Error(`Failed to parse file.`);
      } else {
        throw error; // re-throw the error unchanged
      }
    }
  }

  parseFORM() {
    // Parse "FORM" chunk
    let chunkId = this.binaryStream.readString(4);
    let chunkLength = this.binaryStream.readUint32BE();
    const formatId = this.binaryStream.readString(4);

    // Validate chunk according to notes on https://en.wikipedia.org/wiki/ILBM
    if (chunkId !== "FORM") {
      throw new Error(
        `Invalid chunkId: "${chunkId}" at byte ${this.binaryStream.index}. Expected "FORM".`
      );
    }

    if (chunkLength !== this.binaryStream.length - 8) {
      throw new Error(
        `Invalid chunk length: ${chunkLength} bytes. Expected ${
          this.binaryStream.length - 8
        } bytes.`
      );
    }

    if (formatId !== "PBM ") {
      throw new Error(`Invalid formatId: "${formatId}". Expected "PBM ".`);
    }

    // Parse all other chunks
    while (!this.binaryStream.EOF()) {
      chunkId = this.binaryStream.readString(4);
      chunkLength = this.binaryStream.readUint32BE();

      switch (chunkId) {
        case "BMHD":
          this.parseBMHD();
          break;
        case "CMAP":
          this.parseCMAP();
          break;
        case "DPPS":
          // NOTE(m): Ignore unknown DPPS chunk of size 110 bytes
          this.binaryStream.jump(110);
          break;
        case "CRNG":
          this.parseCRNG();
          break;
        case "TINY":
          this.parseTINY(chunkLength);
          break;
        case "BODY":
          this.parseBODY(chunkLength);
          break;
        default:
          throw new Error(
            `Unsupported chunkId: ${chunkId} at byte ${this.binaryStream.index}`
          );
      }

      // Skip chunk padding byte when chunkLength is not a multiple of 2
      if (chunkLength % 2 === 1) this.binaryStream.jump(1);
    }
  }

  // Parse Bitmap Header chunk
  parseBMHD() {
    this.width = this.binaryStream.readUint16BE();
    this.height = this.binaryStream.readUint16BE();
    this.size = this.width * this.height;
    this.xOrigin = this.binaryStream.readInt16BE();
    this.yOrigin = this.binaryStream.readInt16BE();
    this.numPlanes = this.binaryStream.readUint8();
    this.mask = this.binaryStream.readUint8();
    this.compression = this.binaryStream.readUint8();
    this.binaryStream.readUint8(); // Ignore pad1 field left "for future compatibility"
    this.transClr = this.binaryStream.readUint16BE();
    this.xAspect = this.binaryStream.readUint8();
    this.yAspect = this.binaryStream.readUint8();
    this.pageWidth = this.binaryStream.readInt16BE();
    this.pageHeight = this.binaryStream.readInt16BE();
  }

  // Parse Palette chunk
  parseCMAP() {
    const numColors = 2 ** this.numPlanes;

    // TODO(m): Read 3 bytes at a time?
    for (let i = 0; i < numColors; i++) {
      const rgb = [];
      for (let j = 0; j < 3; j++) {
        rgb.push(this.binaryStream.readByte());
      }
      this.palette.push(rgb);
    }
  }

  // Parse Color range chunk
  parseCRNG() {
    this.binaryStream.jump(2); // 2 bytes padding according to https://en.wikipedia.org/wiki/ILBM#CRNG:_Colour_range

    const rate = this.binaryStream.readInt16BE();
    const flags = this.binaryStream.readInt16BE();
    const low = this.binaryStream.readUint8();
    const high = this.binaryStream.readUint8();

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

    this.cyclingRanges.push({
      rate,
      active: (flags & activeBitMask) !== 0,
      direction: (flags & directionBitMask) !== 0 ? "reverse" : "forward",
      low,
      high,
    });
  }

  // Parse Thumbnail chunk
  parseTINY(chunkLength) {
    const endOfChunkIndex = this.binaryStream.index + chunkLength;

    this.thumbnail.width = this.binaryStream.readUint16BE();
    this.thumbnail.height = this.binaryStream.readUint16BE();
    this.thumbnail.size = this.thumbnail.width * this.thumbnail.height;

    // Decompress pixel data if necessary
    if (this.compression === 1) {
      this.thumbnail.pixelData = this.decompress(endOfChunkIndex);
    } else {
      this.thumbnail.pixelData = this.readUncompressed(endOfChunkIndex);
    }
  }

  // Parse Image data chunk
  parseBODY(chunkLength) {
    const endOfChunkIndex = this.binaryStream.index + chunkLength;

    // Decompress pixel data if necessary
    if (this.compression === 1) {
      this.pixelData = this.decompress(endOfChunkIndex);
    } else {
      this.pixelData = this.readUncompressed(endOfChunkIndex);
    }
  }

  decompress(endOfChunkIndex) {
    const result = [];

    while (this.binaryStream.index < endOfChunkIndex) {
      const byte = this.binaryStream.readByte();

      if (byte > 128) {
        const nextByte = this.binaryStream.readByte();
        for (let i = 0; i < 257 - byte; i++) {
          result.push(nextByte);
        }
      } else if (byte < 128) {
        for (let i = 0; i < byte + 1; i++) {
          result.push(this.binaryStream.readByte());
        }
      } else {
        break;
      }
    }

    return result;
  }

  // TODO(m): Read a range of bytes straight into an array?
  // Use arrayBuffers throughout instead?
  readUncompressed(endOfChunkIndex) {
    const result = [];

    while (this.binaryStream.index < endOfChunkIndex) {
      const byte = this.binaryStream.readByte();
      result.push(byte);
    }

    return result;
  }
}

export default PBM;
