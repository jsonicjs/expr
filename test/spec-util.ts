/* Copyright (c) 2021-2025 Richard Rodger and other contributors, MIT License */

import * as fs from 'fs'
import * as path from 'path'


export type SpecEntry = {
  input: string
  expected: any
}

export function loadSpec(name: string): SpecEntry[] {
  // Resolve spec files relative to the project root test/spec directory,
  // since compiled tests run from dist-test/ but specs live in test/spec/.
  const rootDir = path.resolve(__dirname, '..')
  const specPath = path.join(rootDir, 'test', 'spec', name)
  const content = fs.readFileSync(specPath, 'utf8')
  const entries: SpecEntry[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue

    const tabIdx = trimmed.indexOf('\t')
    if (tabIdx === -1) continue

    const input = trimmed.substring(0, tabIdx)
    const expectedJson = trimmed.substring(tabIdx + 1)

    entries.push({
      input,
      expected: JSON.parse(expectedJson),
    })
  }

  return entries
}
