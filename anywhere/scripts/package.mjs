import { build } from './build.mjs';
import { root } from './verify-original.mjs';
import { resolve } from 'node:path';
build();
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// A small deterministic ZIP writer: relative UTF-8 root files, no extra dependencies.
function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
const files = ['manifest.json', 'extension.js', 'README.md', 'NOTICE'];
const local = [], directory = [], hashes = {};
let offset = 0;
for (const file of files) {
    const name = Buffer.from(file), data = readFileSync(resolve(root, ['manifest.json', 'extension.js'].includes(file) ? `dist/${file}` : file)), compressed = deflateRawSync(data), crc = crc32(data);
    hashes[file] = createHash('sha256').update(data).digest('hex');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    directory.push(central, name); offset += header.length + name.length + compressed.length;
}
const central = Buffer.concat(directory), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...local, central, end]);
const file = 'gacha_minigames_me.personal-extension.zip';
writeFileSync(resolve(root, file), archive);
writeFileSync(resolve(root, 'qa/package.json'), JSON.stringify({ file, bytes: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex'), files: hashes }, null, 2) + '\n');
console.log(`Packaged ${file} (${files.length} files, ${archive.length} bytes)`);
