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

// NOTE(m): Partially copied from
// https://github.com/steffest/DPaint-js/blob/master/_script/util/binarystream.js

class BinaryStream {
  constructor(arrayBuffer) {
    this.index = 0;
    this.data = arrayBuffer;
    this.dataView = new DataView(arrayBuffer);
    this.length = arrayBuffer.byteLength;
  }

  EOF() {
    return this.index === this.length;
  }

  jump(offset) {
    this.index += offset;
  }

  readByte() {
    return this.readUint8();
  }

  readBytes(length) {
    const bytes = [];

    for (let i = 0; i < length; i++) {
      bytes.push(this.readUint8());
    }

    return bytes;
  }

  readInt16BE() {
    const value = this.dataView.getInt16(this.index);

    this.index += 2;
    return value;
  }

  readString(length) {
    let string = "";

    for (let i = 0; i < length; i++) {
      const byte = this.dataView.getUint8(this.index + i);
      string += String.fromCharCode(byte);
    }

    this.index += length;
    return string;
  }

  readUint8() {
    const value = this.dataView.getUint8(this.index);

    this.index += 1;
    return value;
  }

  readUint16BE() {
    const value = this.dataView.getUint16(this.index);

    this.index += 2;
    return value;
  }

  readUint32BE() {
    const value = this.dataView.getUint32(this.index);

    this.index += 4;
    return value;
  }
}

export default BinaryStream;
