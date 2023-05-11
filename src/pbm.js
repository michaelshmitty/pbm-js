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
    let chunkID = this.binaryStream.readString(4);
    const lenChunk = this.binaryStream.readUint32BE();
    const formatID = this.binaryStream.readString(4);

    // Validate chunk according to notes on https://en.wikipedia.org/wiki/ILBM
    if (chunkID !== "FORM") {
      throw new Error(
        `Invalid chunkID: "${chunkID}" at byte ${this.binaryStream.index}. Expected "FORM".`
      );
    }

    if (lenChunk !== this.binaryStream.length - 8) {
      throw new Error(
        `Invalid chunk length: ${lenChunk} bytes. Expected ${
          this.binaryStream.length - 8
        } bytes.`
      );
    }

    if (formatID !== "PBM ") {
      throw new Error(`Invalid formatID: "${formatID}". Expected "PBM ".`);
    }

    // Parse all other chunks
    while (!this.binaryStream.EOF()) {
      chunkID = this.binaryStream.readString(4);
      this.binaryStream.jump(4); // Skip 4 bytes chunk length value

      switch (chunkID) {
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
          this.parseTINY();
          break;
        case "BODY":
          this.parseBODY();
          break;
        default:
          throw new Error(
            `Unsupported chunkID: ${chunkID} at byte ${this.binaryStream.index}`
          );
      }
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

    // FIXME(m): Read 3 bytes at a time?
    for (let i = 0; i < numColors; i++) {
      let rgb = [];
      for (let j = 0; j < 3; j++) {
        rgb.push(this.binaryStream.readByte());
      }
      this.palette.push(rgb);
    }
  }

  // Parse Color range chunk
  parseCRNG() {
    this.binaryStream.jump(2); // 2 bytes padding according to https://en.wikipedia.org/wiki/ILBM#CRNG:_Colour_range
    const cyclingRange = {
      rate: this.binaryStream.readInt16BE(),
      flags: this.binaryStream.readInt16BE(),
      low: this.binaryStream.readUint8(),
      hight: this.binaryStream.readUint8(),
    };

    this.cyclingRanges.push(cyclingRange);
  }

  // Parse Thumbnail chunk
  parseTINY() {
    this.thumbnail.width = this.binaryStream.readUint16BE();
    this.thumbnail.height = this.binaryStream.readUint16BE();
    this.thumbnail.size = this.thumbnail.width * this.thumbnail.height;

    while (this.thumbnail.pixelData.length < this.thumbnail.size) {
      const byte = this.binaryStream.readByte();

      // TODO(m): Deduplicate decompression code for thumbnail and image data
      if (this.compression === 1) {
        // Decompress the data
        if (byte > 128) {
          const nextByte = this.binaryStream.readByte();
          for (let i = 0; i < 257 - byte; i++) {
            this.thumbnail.pixelData.push(nextByte);
          }
        } else if (byte < 128) {
          for (let i = 0; i < byte + 1; i++) {
            this.thumbnail.pixelData.push(this.binaryStream.readByte());
          }
        } else {
          break;
        }
      } else {
        // Data is not compressed, just copy the bytes
        this.thumbnail.pixelData.push(byte);
      }
    }
  }

  // Parse Image data chunk
  parseBODY() {
    // NOTE(m): Should we make use of the chunk length here instead?

    while (this.pixelData.length < this.size) {
      const byte = this.binaryStream.readByte();

      if (this.compression === 1) {
        // Decompress the data
        if (byte > 128) {
          const nextByte = this.binaryStream.readByte();
          for (let i = 0; i < 257 - byte; i++) {
            this.pixelData.push(nextByte);
          }
        } else if (byte < 128) {
          for (let i = 0; i < byte + 1; i++) {
            this.pixelData.push(this.binaryStream.readByte());
          }
        } else {
          break;
        }
      } else {
        // Data is not compressed, just copy the bytes
        this.pixelData.push(byte);
      }
    }
  }
}

export default PBM;
