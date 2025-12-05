import {
  AccountUpdate,
  Bool,
  Field,
  Provable,
  PublicKey,
  SmartContract,
  State,
  UInt64,
  method,
  state,
} from 'o1js';
import { FeedbackProgram } from './FeedbackProgram.js';
import { FeedbackType } from './utils/types.js';

const WINNER_SHARE_BPS = 5000n;
const FEE_BPS = 0n;

class WordleStakeGame extends SmartContract {
  @state(PublicKey) playerA = State<PublicKey>();
  @state(PublicKey) playerB = State<PublicKey>();

  @state(UInt64) stakeAmount = State<UInt64>();
  @state(Field) commitment = State<Field>();

  @state(Bool) hasPlayerA = State<Bool>();
  @state(Bool) hasPlayerB = State<Bool>();
  @state(Bool) isSettled = State<Bool>();

  @state(PublicKey) owner = State<PublicKey>();

  init() {
    super.init();

    this.hasPlayerA.set(Bool(false));
    this.hasPlayerB.set(Bool(false));
    this.isSettled.set(Bool(false));

    this.stakeAmount.set(UInt64.from(0));

    this.owner.set(this.sender.getAndRequireSignature());
  }

  @method async join(stake: UInt64, commitment: Field) {
    const sender = this.sender.getAndRequireSignature();

    const hasA = this.hasPlayerA.get();
    const hasB = this.hasPlayerB.get();
    const settled = this.isSettled.get();

    settled.assertFalse('Game already settled, cannot join.');

    if (!hasA.toBoolean()) {
      this.playerA.set(sender);
      this.hasPlayerA.set(Bool(true));

      this.stakeAmount.set(stake);

      this.commitment.set(commitment);

      const playerAUpdate = AccountUpdate.createSigned(sender);
      playerAUpdate.send({ to: this.address, amount: stake });

      const contractBalance = this.account.balance.get();
      contractBalance.assertEquals(stake);

      return;
    }

    hasA.assertTrue('Player A must join first.');
    hasB.assertFalse('Both players already joined.');

    const playerA = this.playerA.get();
    playerA.equals(sender).assertFalse('Same address cannot be both players.');

    const existingStake = this.stakeAmount.get();
    existingStake.assertEquals(stake);

    this.playerB.set(sender);
    this.hasPlayerB.set(Bool(true));

    const playerBUpdate = AccountUpdate.createSigned(sender);
    playerBUpdate.send({ to: this.address, amount: stake });

    const contractBalance = this.account.balance.get();
    contractBalance.assertEquals(stake.mul(2));
  }

  @method async leave() {
    const sender = this.sender.getAndRequireSignature();

    const hasA = this.hasPlayerA.get();
    const hasB = this.hasPlayerB.get();
    const settled = this.isSettled.get();

    settled.assertFalse('Game already settled, cannot leave.');

    hasA.assertTrue('No player to leave.');

    const playerA = this.playerA.get();

    playerA.assertEquals(sender);

    hasB.assertFalse('Cannot leave after Player B joined.');

    const stakeToReturn = this.stakeAmount.get();
    this.send({ to: playerA, amount: stakeToReturn });

    this.hasPlayerA.set(Bool(false));
    this.playerA.set(PublicKey.empty());
    this.stakeAmount.set(UInt64.from(0));
    this.commitment.set(Field(0));
  }

  @method async settle(finalProof: InstanceType<typeof FeedbackProgram.Proof>) {
    const hasA = this.hasPlayerA.get();
    const hasB = this.hasPlayerB.get();
    const settled = this.isSettled.get();

    hasA.assertTrue('Player A not joined.');
    hasB.assertTrue('Player B not joined.');
    settled.assertFalse('Game already settled.');

    finalProof.verify();

    const storedCommitment = this.commitment.get();

    finalProof.publicInput.commitment.assertEquals(
      storedCommitment,
      'Commitment mismatch between on-chain and ZK game.'
    );

    finalProof.publicOutput.commitment.assertEquals(
      storedCommitment,
      'Commitment mismatch in proof output.'
    );

    const feedback = finalProof.publicOutput.feedback;
    const green = Field(FeedbackType.GREEN);

    let allGreen = Bool(true);
    for (let i = 0; i < feedback.length; i++) {
      allGreen = allGreen.and(feedback[i].equals(green));
    }

    allGreen.assertTrue('Game is not solved according to proof.');

    const winnerIsB = allGreen;
    const winnerIsA = winnerIsB.not();

    const playerA = this.playerA.get();
    const playerB = this.playerB.get();
    const stake = this.stakeAmount.get();

    const total = stake.mul(2);

    const extraFromLoser = stake.mul(Number(WINNER_SHARE_BPS)).div(10000);
    const winnerAmount = stake.add(extraFromLoser);
    const loserAmount = total.sub(winnerAmount);

    winnerIsA.implies(winnerIsB.not()).assertTrue();
    winnerIsB.implies(winnerIsA.not()).assertTrue();

    const winnerAmountA = Provable.if(winnerIsA, winnerAmount, UInt64.from(0));
    const winnerAmountB = Provable.if(winnerIsB, winnerAmount, UInt64.from(0));
    const loserAmountA = Provable.if(winnerIsA, loserAmount, UInt64.from(0));
    const loserAmountB = Provable.if(winnerIsB, loserAmount, UInt64.from(0));

    this.send({ to: playerA, amount: winnerAmountA.add(loserAmountA) });
    this.send({ to: playerB, amount: winnerAmountB.add(loserAmountB) });

    this.isSettled.set(Bool(true));
  }
}

export { WordleStakeGame, WINNER_SHARE_BPS, FEE_BPS };
