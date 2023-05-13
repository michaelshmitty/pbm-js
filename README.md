# pbm-js

JavaScript library for IFF PBM files.

This is the format used by the PC version of Deluxe Paint II and is different from the Amiga version.

## Features

- Written using ES6 modules, runs out of the box in modern browsers.
- 100% plain JavaScript. No dependencies.
- Compatible with all [Mark J. Ferrari](https://www.markferrari.com/about/)'s artwork I could find.

## Usage

### In the browser

_Also see `index.html` and `main.js` for a more elaborate example that renders the palletized image data to a html5 canvas._

```javascript
import PBM from "./src/pbm.js";

fetch("/assets/TEST.LBM")
  .then((response) => {
    return response.arrayBuffer();
  })
  .then((buffer) => {
    const image = new PBM(buffer);
    console.log(image);
  });
```

### In Node.js

```javascript
import * as fs from "fs";

import PBM from "./src/pbm.js";

const data = fs.readFileSync("./tests/fixtures/VALID.LBM");
const image = new PBM(data.buffer);
console.log(image);
```

## Testing

```sh
# Install test framework and dependencies (requires Node.js)
npm install
# Run the tests
npm run test
```

## References

- [libiff](https://github.com/svanderburg/libiff): Portable, extensible parser for the Interchange File Format (IFF). Well documented and very detailed C implementation of the IFF file format by [Sander van der Burg](http://sandervanderburg.nl/index.php).
- [DPaint-js](https://github.com/steffest/DPaint-js): Web based image editor, modeled after the legendary Deluxe Paint with a focus on retro Amiga file formats: read and write Amiga icon files and IFF ILBM images.

## Contributing

This software is currently in alpha version. Bug reports and pull requests welcome. If you find an IFF PBM file that cannot be parsed by this library, please send it to me if licensing / copyright permits you to share it.
