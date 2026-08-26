import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const copy = (from, to) => {
  mkdirSync(dirname(resolve(root, to)), { recursive: true });
  cpSync(resolve(root, from), resolve(root, to), { recursive: true });
};

copy("node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js");
copy("node_modules/tesseract.js-core/tesseract-core.wasm.js", "public/ocr/core/tesseract-core.wasm.js");
copy("node_modules/tesseract.js-core/tesseract-core-simd.wasm.js", "public/ocr/core/tesseract-core-simd.wasm.js");
copy("node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "public/ocr/core/tesseract-core-lstm.wasm.js");
copy("node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "public/ocr/core/tesseract-core-simd-lstm.wasm.js");
copy("node_modules/tesseract.js-core/tesseract-core.wasm", "public/ocr/core/tesseract-core.wasm");
copy("node_modules/tesseract.js-core/tesseract-core-simd.wasm", "public/ocr/core/tesseract-core-simd.wasm");
copy("node_modules/tesseract.js-core/tesseract-core-lstm.wasm", "public/ocr/core/tesseract-core-lstm.wasm");
copy("node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm", "public/ocr/core/tesseract-core-simd-lstm.wasm");
copy("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", "public/ocr/lang/eng.traineddata.gz");
