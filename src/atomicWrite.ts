import { randomBytes } from 'crypto'
import fs from 'fs'

const OWNER_ONLY_MODE = 0o600
const TMP_SUFFIX_BYTES = 6

// Every write goes through its own temporary file, created exclusively. A
// shared '<file>.tmp' let concurrent writes of one file rename each other's
// half-written temporary file into place: the target could end up truncated
// and later renames failed with ENOENT.
function tmpPathFor(filePath: string): string {
  return `${filePath}.${randomBytes(TMP_SUFFIX_BYTES).toString('hex')}.tmp`
}

export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmp = tmpPathFor(filePath)
  try {
    fs.writeFileSync(tmp, data, { flag: 'wx' })
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {}
    throw err
  }
}

// The temporary file is created exclusively with owner-only permissions, so
// the data is never readable by others, not even briefly, and a stale or
// concurrent temporary file is never reused.
export function atomicWriteOwnerOnlyFileSync(
  filePath: string,
  data: string
): void {
  const tmp = tmpPathFor(filePath)
  try {
    fs.writeFileSync(tmp, data, { mode: OWNER_ONLY_MODE, flag: 'wx' })
    fs.renameSync(tmp, filePath)
  } catch (err) {
    try {
      fs.unlinkSync(tmp)
    } catch {}
    throw err
  }
}

export async function atomicWriteFile(
  filePath: string,
  data: string
): Promise<void> {
  const tmp = tmpPathFor(filePath)
  try {
    await fs.promises.writeFile(tmp, data, { flag: 'wx' })
    await fs.promises.rename(tmp, filePath)
  } catch (err) {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
    throw err
  }
}
