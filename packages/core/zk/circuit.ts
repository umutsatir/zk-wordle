import { Field, Provable, Struct, ZkProgram } from "o1js";
import { computeFeedback } from "./feedback";

class publicInputs extends Struct({ guessWord: Field, commitment: Field }) {}
class privateInputs extends Struct({ actualWord: Field, salt: Field }) {}
class publicOutputs extends Struct({ feedback: Provable.Array(Field, 5) }) {}

const MainCircuit = ZkProgram({
    name: "commitment-circuit",
    publicInput: publicInputs,
    publicOutput: publicOutputs,
    methods: {
        computeFeedback: {
            privateInputs: [privateInputs],
            method: async (
                publicInput: publicInputs,
                privateInput: privateInputs
            ) => {
                const feedback = computeFeedback(
                    publicInput.guessWord.toString(),
                    privateInput.actualWord.toString()
                );
                return {
                    publicOutput: {
                        feedback: feedback,
                    },
                };
            },
        },
    },
});

MainCircuit.compile();
const result = await MainCircuit.computeFeedback(
    { guessWord: "hello", commitment: "world" },
    { actualWord: "hello", salt: "world" }
);

console.log(result.proof, result.auxiliaryOutput);
