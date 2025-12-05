import { Field, Provable, Proof, Struct, ZkProgram, SelfProof } from 'o1js';
import { CommitmentProgram } from './CommitmentProgram.js';
import { computeFeedbackFields } from './utils/feedback.js';

class publicInputs extends Struct({
  guessWord: Provable.Array(Field, 5),
  commitment: Field,
  step: Field,
}) {}

class publicOutputs extends Struct({
  feedback: Provable.Array(Field, 5),
  commitment: Field,
}) {}

class privateInputs extends Struct({
  actualWord: Provable.Array(Field, 5),
  salt: Field,
}) {}

const FeedbackProgram = ZkProgram({
  name: 'feedback-program',
  publicInput: publicInputs,
  publicOutput: publicOutputs,
  methods: {
    // First step: only uses commitmentProof, no previousProof
    computeFirstFeedback: {
      privateInputs: [CommitmentProgram.Proof, privateInputs],
      async method(
        publicInput: publicInputs,
        commitmentProof: Proof<unknown, { commitment: Field }>,
        privateInput: privateInputs
      ) {
        // Ensure this is step 0
        publicInput.step.assertEquals(Field(0), 'First step must be step 0');

        commitmentProof.verify();

        // Use commitment from CommitmentProgram proof
        commitmentProof.publicOutput.commitment.assertEquals(
          publicInput.commitment,
          'Commitment mismatch'
        );

        const feedback = computeFeedbackFields(
          privateInput.actualWord,
          publicInput.guessWord
        );

        return {
          publicOutput: {
            feedback: feedback,
            commitment: publicInput.commitment,
          },
        };
      },
    },
    // Subsequent steps: uses previousProof for recursive chain
    computeFeedback: {
      privateInputs: [
        SelfProof<publicInputs, publicOutputs>,
        CommitmentProgram.Proof,
        privateInputs,
      ],
      async method(
        publicInput: publicInputs,
        previousProof: SelfProof<publicInputs, publicOutputs>,
        commitmentProof: Proof<unknown, { commitment: Field }>,
        privateInput: privateInputs
      ) {
        // Ensure this is not step 0
        publicInput.step.assertGreaterThan(Field(0), 'Must not be first step');

        previousProof.verify();
        commitmentProof.verify();

        // Chain commitment from previous proof
        previousProof.publicInput.commitment.assertEquals(
          publicInput.commitment,
          'Commitment mismatch in recursive chain'
        );

        // Verify commitmentProof matches (for consistency)
        commitmentProof.publicOutput.commitment.assertEquals(
          publicInput.commitment,
          'CommitmentProof commitment mismatch'
        );

        const feedback = computeFeedbackFields(
          privateInput.actualWord,
          publicInput.guessWord
        );

        return {
          publicOutput: {
            feedback: feedback,
            commitment: publicInput.commitment,
          },
        };
      },
    },
  },
});

export { FeedbackProgram };
