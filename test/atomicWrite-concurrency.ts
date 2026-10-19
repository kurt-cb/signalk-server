import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { atomicWriteFile } from '../src/atomicWrite'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DeltaEditor = require('../src/deltaeditor')

// A plugin registering metadata for many paths at once triggers one
// baseDeltas.json save per path, all overlapping. With a shared '<file>.tmp'
// those saves renamed each other's half-written file into place: the target
// could be left truncated, and on the next start the vessel's base data
// (name, MMSI, design) was lost.
describe('atomic writes under concurrency', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-atomic-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('overlapping atomicWriteFile calls on one file all succeed and leave a complete file', async () => {
    const file = path.join(dir, 'baseDeltas.json')
    const payloads = Array.from({ length: 80 }, (_, i) =>
      JSON.stringify({ i, pad: 'x'.repeat(20000 + i) })
    )
    await Promise.all(payloads.map((p) => atomicWriteFile(file, p)))
    const written = fs.readFileSync(file, 'utf8')
    expect(payloads).to.include(written)
    expect(() => JSON.parse(written)).not.to.throw()
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).to.deep.equal(
      []
    )
  })

  it('overlapping DeltaEditor saves end with the newest state on disk', async () => {
    const file = path.join(dir, 'baseDeltas.json')
    const editor = new DeltaEditor()
    editor.setSelfValue('name', 'valkyrie')
    editor.setSelfValue('mmsi', '338534451')
    const saves = []
    for (let i = 0; i < 40; i++) {
      editor.setMeta('vessels.self', `sensors.s${i}.temperature`, {
        units: 'K'
      })
      saves.push(editor.save(file))
    }
    await Promise.all(saves)
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(onDisk).to.deep.equal(editor.deltas)
    const reread = new DeltaEditor()
    reread.load(file)
    expect(reread.getSelfValue('name')).to.equal('valkyrie')
    expect(reread.getSelfValue('mmsi')).to.equal('338534451')
  })
})
