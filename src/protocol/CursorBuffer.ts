/**
 * Simple growable byte buffer with read/write cursors.
 *
 * Avoids per-chunk Buffer.concat by compacting/growing occasionally. Used by
 * protocol engines to buffer and parse streaming socket data.
 */
export class CursorBuffer {
  private buf: Buffer;
  private readPos = 0;
  private writePos = 0;

  constructor(initialCapacity = 64 * 1024) {
    this.buf = Buffer.allocUnsafe(initialCapacity);
  }

  available(): number {
    return this.writePos - this.readPos;
  }

  append(chunk: Buffer): void {
    if (chunk.length === 0) {
      return;
    }
    this.ensureWritable(chunk.length);
    chunk.copy(this.buf, this.writePos);
    this.writePos += chunk.length;
  }

  peekUInt8(relOffset = 0): number {
    return this.buf.readUInt8(this.readPos + relOffset);
  }

  peekUInt32BE(relOffset = 0): number {
    return this.buf.readUInt32BE(this.readPos + relOffset);
  }

  peekBigUInt64BE(relOffset = 0): bigint {
    return this.buf.readBigUInt64BE(this.readPos + relOffset);
  }

  readUInt8(): number {
    const v = this.buf.readUInt8(this.readPos);
    this.readPos += 1;
    this.maybeReset();
    return v;
  }

  readUInt32BE(): number {
    const v = this.buf.readUInt32BE(this.readPos);
    this.readPos += 4;
    this.maybeReset();
    return v;
  }

  readBigUInt64BE(): bigint {
    const v = this.buf.readBigUInt64BE(this.readPos);
    this.readPos += 8;
    this.maybeReset();
    return v;
  }

  readBytes(length: number): Buffer {
    const out = this.buf.subarray(this.readPos, this.readPos + length);
    this.readPos += length;
    this.maybeReset();
    return out;
  }

  discard(length: number): void {
    this.readPos += length;
    this.maybeReset();
  }

  private ensureWritable(length: number): void {
    const freeTail = this.buf.length - this.writePos;
    if (freeTail >= length) {
      return;
    }

    // Compact unread bytes to the front if it helps.
    if (this.readPos > 0) {
      this.buf.copy(this.buf, 0, this.readPos, this.writePos);
      this.writePos -= this.readPos;
      this.readPos = 0;
    }

    if (this.buf.length - this.writePos >= length) {
      return;
    }

    // Grow buffer capacity (doubling).
    const required = this.writePos + length;
    let newCap = this.buf.length === 0 ? 1024 : this.buf.length;
    while (newCap < required) {
      newCap *= 2;
    }

    const next = Buffer.allocUnsafe(newCap);
    if (this.writePos > 0) {
      this.buf.copy(next, 0, 0, this.writePos);
    }
    this.buf = next;
  }

  private maybeReset(): void {
    if (this.readPos === this.writePos) {
      this.readPos = 0;
      this.writePos = 0;
    }
  }
}
