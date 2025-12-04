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
    computeFeedback: {
      // previousProof: recursive FeedbackProgram proof
      // commitmentProof: CommitmentProgram proof binding the commitment
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
        previousProof.verify();
        commitmentProof.verify();

        const isFirstStep = publicInput.step.equals(Field(0));

        const chainedCommitment = Provable.if(
          isFirstStep,
          commitmentProof.publicOutput.commitment,
          previousProof.publicInput.commitment
        );

        chainedCommitment.assertEquals(publicInput.commitment);

        const feedback = computeFeedbackFields(
          privateInput.actualWord,
          publicInput.guessWord
        );
        return {
          publicOutput: {
            feedback: feedback,
            commitment: chainedCommitment,
          },
        };
      },
    },
  },
});

export { FeedbackProgram };
