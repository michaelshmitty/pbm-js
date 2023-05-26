/* eslint-disable no-new */
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

import { expect, test } from 'vitest';

import PBM from '../src/pbm.js';

const fs = require('fs');

test('Successfully parse a PBM file', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');

  expect(() => {
    new PBM(data.buffer);
  }).not.toThrowError();
});

test('Fail to parse a PBM file with an invalid chunk id', () => {
  const data = fs.readFileSync('./tests/fixtures/INVALID_CHUNK_ID.LBM');

  expect(() => {
    new PBM(data.buffer);
  }).toThrowError(/^Invalid chunkId: "FARM" at byte 12. Expected "FORM".$/);
});

test('Fail to parse a PBM file with an invalid chunk length', () => {
  const data = fs.readFileSync('./tests/fixtures/INVALID_CHUNK_LENGTH.LBM');

  expect(() => {
    new PBM(data.buffer);
  }).toThrowError(/^Invalid chunk length: 7070 bytes. Expected 7012 bytes.$/);
});

test('Fail to parse an IFF file that is not a PBM file', () => {
  const data = fs.readFileSync('./tests/fixtures/SEASCAPE.LBM');

  expect(() => {
    new PBM(data.buffer);
  }).toThrowError(/^Invalid formatId: "ILBM". Expected "PBM ".$/);
});

test('Parse a PBM bitmap header', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');
  const image = new PBM(data.buffer);

  expect(image.width).toStrictEqual(640);
  expect(image.height).toStrictEqual(480);
  expect(image.size).toStrictEqual(307_200);
  expect(image.xOrigin).toStrictEqual(0);
  expect(image.yOrigin).toStrictEqual(0);
  expect(image.numPlanes).toStrictEqual(8);
  expect(image.mask).toStrictEqual(0);
  expect(image.compression).toStrictEqual(1);
  expect(image.transClr).toStrictEqual(255);
  expect(image.xAspect).toStrictEqual(1);
  expect(image.yAspect).toStrictEqual(1);
  expect(image.pageWidth).toStrictEqual(640);
  expect(image.pageHeight).toStrictEqual(480);
});

test('Parse PBM palette information', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');
  const image = new PBM(data.buffer);

  expect(image.palette.length).toStrictEqual(256);
  expect(image.palette[10]).toStrictEqual([87, 255, 87]);
});

test('Parse PBM color cycling information', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');
  const image = new PBM(data.buffer);

  expect(image.cyclingRanges.length).toStrictEqual(16);
});

test('Parse PBM thumbnail', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');
  const image = new PBM(data.buffer);

  expect(image.thumbnail.width).toStrictEqual(80);
  expect(image.thumbnail.height).toStrictEqual(60);
  expect(image.thumbnail.size).toStrictEqual(4800);
});

test('Decode PBM thumbnail pixel data', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');
  const image = new PBM(data.buffer);

  expect(image.thumbnail.pixelData.length).toStrictEqual(4800);
  // FIXME(m): Verify these values are correct in the test image thumbnail:
  expect(image.thumbnail.pixelData[0]).toStrictEqual(14);
  expect(image.palette[14]).toStrictEqual([255, 255, 87]);
});

test('Decode PBM image pixel data', () => {
  const data = fs.readFileSync('./tests/fixtures/VALID.LBM');
  const image = new PBM(data.buffer);

  expect(image.pixelData.length).toStrictEqual(307_200);
  // FIXME(m): Verify these values are correct in the test image:
  expect(image.pixelData[0]).toStrictEqual(14);
  expect(image.palette[14]).toStrictEqual([255, 255, 87]);
});
