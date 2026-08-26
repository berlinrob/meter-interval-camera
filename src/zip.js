const crcTable = new Uint32Array(256).map((_, index) => { let value = index; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
const encoder = new TextEncoder();
const u16 = (value) => Uint8Array.of(value & 255, (value >>> 8) & 255);
const u32 = (value) => Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
const join = (parts) => { const length = parts.reduce((sum, part) => sum + part.length, 0); const output = new Uint8Array(length); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; };
const crc32 = (bytes) => { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; };

export async function createZip(entries) {
  const files = await Promise.all(entries.map(async (entry) => ({ ...entry, nameBytes: encoder.encode(entry.name), bytes: entry.bytes ?? new Uint8Array(await entry.blob.arrayBuffer()) })));
  let offset = 0;
  const localFiles = [];
  const centralFiles = [];
  for (const file of files) {
    const crc = crc32(file.bytes);
    const local = join([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(file.bytes.length), u32(file.bytes.length), u16(file.nameBytes.length), u16(0), file.nameBytes, file.bytes]);
    localFiles.push(local);
    centralFiles.push(join([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(file.bytes.length), u32(file.bytes.length), u16(file.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), file.nameBytes]));
    offset += local.length;
  }
  const central = join(centralFiles);
  return new Blob([...localFiles, central, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)], { type: "application/zip" });
}
