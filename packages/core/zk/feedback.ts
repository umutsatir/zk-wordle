import { Bool, Field, Provable } from "o1js";
import { wordToFields } from "./utils";
import { FeedbackType } from "./types";

function computeFeedback(actualWord: string, guess: string): Field[] {
    const actualWordFields = wordToFields(actualWord);
    const guessFields = wordToFields(guess);
    const feedback = Array.from({ length: 5 }, () => Field(FeedbackType.GRAY));
    const used = Array(5).fill(false);

    // Green pass
    for (let i = 0; i < 5; i++) {
        if (guessFields[i].equals(actualWordFields[i]).toBoolean()) {
            feedback[i] = Field(FeedbackType.GREEN);
            used[i] = true;
        }
    }

    // Yellow pass
    for (let i = 0; i < 5; i++) {
        if (!used[i]) {
            for (let j = 0; j < 5; j++) {
                const matches = guessFields[i]
                    .equals(actualWordFields[j])
                    .toBoolean();
                const isValid = !used[j] && matches;
                feedback[i] = isValid
                    ? Field(FeedbackType.YELLOW)
                    : Field(FeedbackType.GRAY);
                if (isValid) {
                    used[j] = true;
                    break;
                }
            }
        }
    }

    return feedback;
}

function encodeFeedback(feedback: FeedbackType[]): Field {
    let result = BigInt(0);
    for (let i = 0; i < 5; i++) {
        result += BigInt(feedback[i]) * 3n ** BigInt(i);
    }
    return Field(result);
}

function decodeFeedback(encoded: Field): FeedbackType[] {
    let n = encoded.toBigInt();
    const feedback: FeedbackType[] = [];
    for (let i = 0; i < 5; i++) {
        feedback.push(Number(n % 3n) as FeedbackType);
        n /= 3n;
    }
    return feedback;
}

export { computeFeedback, encodeFeedback, decodeFeedback };
