import { Field } from 'o1js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

import { CommitmentProgram } from './CommitmentProgram.js';
import { FeedbackProgram } from './FeedbackProgram.js';
import { FeedbackType } from './utils/types.js';
import { wordToFields } from './utils/utils.js';

const toBigIntArray = (fields: Field[]) =>
  fields.map((field) => field.toBigInt());

const grayFeedback = () =>
  Array.from({ length: 5 }, () => Field(FeedbackType.GRAY));

async function createCommitment(word: string, saltValue = 7n) {
  const wordFields = wordToFields(word);
  const salt = Field(saltValue);
  const { proof } = await CommitmentProgram.createCommitment({
    word: wordFields,
    salt,
  });

  return {
    wordFields,
    salt,
    commitment: proof.publicOutput.commitment,
    commitmentProof: proof,
  };
}

describe('FeedbackProgram', () => {
  before(async () => {
    await CommitmentProgram.compile();
    await FeedbackProgram.compile();
  });

  it('returns all green feedback when guess matches actual word', async () => {
    const { commitment, wordFields, salt, commitmentProof } =
      await createCommitment('hello');
    const guessWord = wordToFields('hello');

    const { proof } = await FeedbackProgram.computeFirstFeedback(
      { guessWord, commitment, step: Field(0) },
      commitmentProof,
      { actualWord: wordFields, salt }
    );

    const feedback = toBigIntArray(proof.publicOutput.feedback);
    assert.deepStrictEqual(feedback, Array(5).fill(BigInt(FeedbackType.GREEN)));
  });

  it('chains proofs so each guess references the prior response', async () => {
    const { commitment, wordFields, salt, commitmentProof } =
      await createCommitment('hello');

    const guessOne = wordToFields('hills');
    const { proof: firstProof } = await FeedbackProgram.computeFirstFeedback(
      { guessWord: guessOne, commitment, step: Field(0) },
      commitmentProof,
      { actualWord: wordFields, salt }
    );

    const feedbackOne = toBigIntArray(firstProof.publicOutput.feedback);
    assert.deepStrictEqual(
      feedbackOne,
      [
        FeedbackType.GREEN,
        FeedbackType.GRAY,
        FeedbackType.GREEN,
        FeedbackType.GREEN,
        FeedbackType.GRAY,
      ].map(BigInt)
    );

    const guessTwo = wordToFields('cello');
    const { proof: secondProof } = await FeedbackProgram.computeFeedback(
      { guessWord: guessTwo, commitment, step: Field(1) },
      firstProof,
      commitmentProof,
      { actualWord: wordFields, salt }
    );

    const feedbackTwo = toBigIntArray(secondProof.publicOutput.feedback);
    assert.deepStrictEqual(
      feedbackTwo,
      [
        FeedbackType.GRAY,
        FeedbackType.GREEN,
        FeedbackType.GREEN,
        FeedbackType.GREEN,
        FeedbackType.GREEN,
      ].map(BigInt)
    );
  });

  it('rejects guesses that try to change the commitment mid-game', async () => {
    const {
      commitment: commitmentA,
      wordFields,
      salt,
      commitmentProof: commitmentProofA,
    } = await createCommitment('hello', 11n);
    const { commitment: commitmentB, commitmentProof: commitmentProofB } =
      await createCommitment('cigar', 13n);

    // First step with commitmentA
    const { proof: firstProof } = await FeedbackProgram.computeFirstFeedback(
      {
        guessWord: wordToFields('hello'),
        commitment: commitmentA,
        step: Field(0),
      },
      commitmentProofA,
      { actualWord: wordFields, salt }
    );

    // Try to use commitmentB in second step (should fail)
    await assert.rejects(
      FeedbackProgram.computeFeedback(
        {
          guessWord: wordToFields('cigar'),
          commitment: commitmentB,
          step: Field(1),
        },
        firstProof,
        commitmentProofB,
        { actualWord: wordFields, salt }
      )
    );
  });
});
