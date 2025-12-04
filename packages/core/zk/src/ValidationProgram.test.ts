import { Field } from 'o1js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  MERKLE_HEIGHT,
  MERKLE_ROOT,
  ValidationProgram,
} from './ValidationProgram.js';
import { wordToFields } from './utils/utils.js';

describe('ValidationProgram', () => {
  type WitnessInfo = { index: number; witness: string[] };
  let witnesses: Record<string, WitnessInfo>;
  let rootInfo: { root: string; count: number; height: number };

  before(async () => {
    await ValidationProgram.compile();

    const rootPath = path.resolve('src/word-validation/data/words.root.json');
    const witnessesPath = path.resolve(
      'src/word-validation/data/words.witnesses.json'
    );

    rootInfo = JSON.parse(fs.readFileSync(rootPath, 'utf8'));
    witnesses = JSON.parse(fs.readFileSync(witnessesPath, 'utf8'));

    // Sanity checks: sabitler ile dosyalar uyumlu mu?
    assert.strictEqual(rootInfo.height - 1, MERKLE_HEIGHT);
    assert.strictEqual(Field(rootInfo.root).toString(), MERKLE_ROOT.toString());
  });

  it('accepts a word that exists in the dictionary', async () => {
    const [word] = Object.keys(witnesses);
    const { index, witness } = witnesses[word];
    const witnessFields = witness.map((w) => Field(w));

    await ValidationProgram.validateWord(
      {
        word: wordToFields(word),
        expectedRoot: MERKLE_ROOT, // rootInfo.root ile eşleşiyor
      },
      {
        index: Field(index),
        witness: witnessFields,
      }
    );
  });

  it('rejects when the expectedRoot does not match the Merkle tree root', async () => {
    const [word] = Object.keys(witnesses);
    const { index, witness } = witnesses[word];
    const witnessFields = witness.map((w) => Field(w));

    await assert.rejects(
      ValidationProgram.validateWord(
        {
          word: wordToFields(word),
          expectedRoot: MERKLE_ROOT.add(1),
        },
        {
          index: Field(index),
          witness: witnessFields,
        }
      )
    );
  });
});
