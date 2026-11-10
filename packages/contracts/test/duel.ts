import { strict as assert } from "node:assert";
import { expect } from "chai";
import type { Contract } from "ethers";
import { FhevmType } from "@fhevm/mock-utils";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function fixture() {
  const [a, b, guest] = await ethers.getSigners();
  const duel = await ethers.deployContract("SecretPandaDuel") as Contract;
  const address = await duel.getAddress();
  const as = (player: typeof a) => duel.connect(player) as Contract;
  const blue = as(a);
  const red = as(b);
  const visitor = as(guest);

  async function open() {
    const receipt = await (await blue.createRoom()).wait();
    for (const log of receipt.logs) {
      const event = duel.interface.parseLog(log);
      if (event?.name === "RoomCreated") return event.args.roomId as bigint;
    }
    throw new Error("Missing RoomCreated event");
  }

  async function start() {
    const id = await open();
    await red.joinRoom(id);
    return id;
  }

  function encrypt(player: typeof a, move: number) {
    return fhevm.createEncryptedInput(address, player.address).add8(move).encrypt();
  }

  async function submit(id: bigint, player: typeof a, move: number, round = 1) {
    const { handles: [handle], inputProof } = await encrypt(player, move);
    return as(player).submitRoundMove(id, round, handle, inputProof);
  }

  async function proof(id: bigint) {
    const { encryptedResult } = await duel.getRoom(id);
    const data = await fhevm.publicDecrypt([encryptedResult]);
    return [data.clearValues[encryptedResult], data.decryptionProof] as const;
  }

  async function finish(id: bigint) {
    await visitor.finalizeRound(id, ...await proof(id));
  }

  async function play(id: bigint, round: number, moveA: number, moveB: number) {
    await submit(id, a, moveA, round);
    await submit(id, b, moveB, round);
    await finish(id);
  }

  return { duel, address, a, b, guest, blue, red, visitor, open, start, encrypt, submit, proof, finish, play };
}

describe("SecretPandaDuel with official FHEVM helpers", function () {
  it("assigns unique four-digit codes and admits only two players", async function () {
    const { duel, b, blue, red, visitor, open } = await fixture();
    const id = await open();
    const ids = new Set([id]);
    for (let i = 0; i < 31; i++) {
      const next = await open();
      expect(ids.has(next)).to.equal(false);
      ids.add(next);
    }
    expect([...ids].every(code => code >= 1000n && code <= 9999n)).to.equal(true);
    expect(await duel.roomCount()).to.equal(32);
    await expect(duel.getRoom(999)).to.be.revertedWithCustomError(duel, "RoomNotFound");
    await expect(blue.joinRoom(id)).to.be.revertedWithCustomError(duel, "CannotJoin");
    await expect(red.joinRoom(id)).to.emit(duel, "RoomJoined").withArgs(id, b.address);
    await expect(visitor.joinRoom(id)).to.be.revertedWithCustomError(duel, "WrongPhase");
  });

  it("sets and edits public usernames by wallet and validates the allowed characters and length", async function () {
    const { duel, a, b, blue, red } = await fixture();
    await expect(blue.setUsername("Panda_01")).to.emit(duel, "UsernameUpdated").withArgs(a.address, "Panda_01");
    await red.setUsername("Red");
    await blue.setUsername("Blue2");
    expect(await duel.usernames(a.address)).to.equal("Blue2");
    expect(await duel.usernames(b.address)).to.equal("Red");
    for (const invalid of ["", "AB", "x".repeat(21), "Panda Red", "Pánda", "<tag>"]) {
      await expect(blue.setUsername(invalid)).to.be.revertedWithCustomError(duel, "InvalidUsername");
    }
  });

  it("rejects outsiders, wrong-wallet inputs, malformed proofs, duplicates and cross-room input replay", async function () {
    const { duel, a, b, guest, blue, red, start, encrypt, submit } = await fixture();
    const id = await start();
    const other = await start();
    const { handles: [handle], inputProof } = await encrypt(a, 1);
    await expect(submit(id, guest, 0)).to.be.revertedWithCustomError(duel, "NotParticipant");
    await expect(blue.submitMove(id, handle, "0x12")).to.be.reverted;
    await expect(blue.submitMove(id, handle, "0x")).to.be.revertedWithCustomError(duel, "MissingInputProof");
    await expect(red.submitMove(id, handle, inputProof)).to.be.reverted;
    await expect(blue.submitMove(id, handle, inputProof)).to.emit(duel, "MoveSubmitted");
    await expect(submit(id, a, 2)).to.be.revertedWithCustomError(duel, "AlreadySubmitted");
    await expect(blue.submitMove(other, handle, inputProof)).to.be.revertedWithCustomError(duel, "InputAlreadyUsed");
    await expect(submit(id, b, 0)).to.emit(duel, "ResultReady");
  });

  for (const [aMove, bMove, expected] of [
    [0, 2, 1], [0, 1, 2], [1, 0, 1], [1, 2, 2], [2, 1, 1], [2, 0, 2],
    [0, 0, 0], [1, 1, 0], [2, 2, 0], [3, 0, 3], [0, 255, 3], [255, 255, 3],
  ]) {
    it(`finalizes encrypted ${aMove} vs ${bMove} as ${expected}`, async function () {
      const { duel, a, b, start, submit, finish } = await fixture();
      const id = await start();
      if ((aMove + bMove) % 2) {
        await submit(id, b, bMove);
        await submit(id, a, aMove);
      } else {
        await submit(id, a, aMove);
        await submit(id, b, bMove);
      }
      const pending = await duel.getRoom(id);
      expect(pending.phase).to.equal(2);
      expect(pending.submittedA && pending.submittedB).to.equal(true);
      await finish(id);
      const [room, score] = await duel.getMatchRoom(id);
      expect(score.played).to.equal(1);
      expect(score.rounds[0]).to.equal(expected);
      expect(score.winsA).to.equal(expected === 1 ? 1 : 0);
      expect(score.winsB).to.equal(expected === 2 ? 1 : 0);
      expect(room.phase).to.equal(expected === 3 ? 3 : 1);
      if (expected === 3) expect(room.result).to.equal(3);
      expect(await duel.getPlayerStats(a.address)).to.deep.equal([0n, 0n, 0n]);
      expect(await duel.getPlayerStats(b.address)).to.deep.equal([0n, 0n, 0n]);
    });
  }

  it("rejects early finalization, altered results, invalid proofs and proof replay", async function () {
    const { duel, a, b, start, submit, proof, finish } = await fixture();
    const id = await start();
    await submit(id, a, 0);
    await expect(duel.finalizeRound(id, 0, "0x")).to.be.revertedWithCustomError(duel, "WrongPhase");
    await submit(id, b, 0);
    const [result, signature] = await proof(id);
    await expect(duel.finalizeRound(id, 4, signature)).to.be.revertedWithCustomError(duel, "InvalidResult");
    await expect(duel.finalizeRound(id, result, "0x12")).to.be.reverted;
    await expect(duel.finalizeRound(id, 1, signature)).to.be.reverted;
    const other = await start();
    await submit(other, a, 0);
    await submit(other, b, 0);
    await expect(duel.finalizeRound(other, result, signature)).to.be.reverted;
    await finish(id);
    await expect(duel.finalizeRound(id, result, signature)).to.be.revertedWithCustomError(duel, "WrongPhase");
  });

  it("awards a 2–0 match once and rejects stale moves and proofs in the following round", async function () {
    const { duel, a, b, blue, start, encrypt, submit, proof, finish } = await fixture();
    const id = await start();
    const input = await encrypt(a, 0);
    await blue.submitRoundMove(id, 1, input.handles[0], input.inputProof);
    await submit(id, b, 2);
    const previousProof = await proof(id);
    await finish(id);
    const [next] = await duel.getMatchRoom(id);
    expect(next.submittedA || next.submittedB).to.equal(false);
    expect(next.encryptedResult).to.equal(ethers.ZeroHash);
    await expect(submit(id, a, 0, 1)).to.be.revertedWithCustomError(duel, "WrongRound");
    await expect(blue.submitRoundMove(id, 2, input.handles[0], input.inputProof)).to.be.revertedWithCustomError(duel, "InputAlreadyUsed");
    await submit(id, a, 1, 2);
    await submit(id, b, 0, 2);
    await expect(duel.finalizeRound(id, ...previousProof)).to.be.reverted;
    await finish(id);
    const [room, score] = await duel.getMatchRoom(id);
    expect(room.phase).to.equal(3);
    expect(room.result).to.equal(1);
    expect(score.played).to.equal(2);
    expect(await duel.getPlayerStats(a.address)).to.deep.equal([1n, 0n, 0n]);
    expect(await duel.getPlayerStats(b.address)).to.deep.equal([0n, 1n, 0n]);
    await expect(submit(id, a, 0, 3)).to.be.revertedWithCustomError(duel, "WrongPhase");
  });

  it("awards a 2–1 match on the third round", async function () {
    const { duel, a, b, start, play } = await fixture();
    const id = await start();
    await play(id, 1, 0, 2);
    await play(id, 2, 0, 1);
    await play(id, 3, 1, 2);
    const [room, score] = await duel.getMatchRoom(id);
    expect(room.phase).to.equal(3);
    expect(room.result).to.equal(2);
    expect(score.rounds).to.deep.equal([1n, 2n, 2n]);
    expect(await duel.getPlayerStats(a.address)).to.deep.equal([0n, 1n, 0n]);
    expect(await duel.getPlayerStats(b.address)).to.deep.equal([1n, 0n, 0n]);
  });

  it("draws after three rounds if neither player wins two", async function () {
    const { duel, a, b, start, play } = await fixture();
    const id = await start();
    await play(id, 1, 0, 2);
    await play(id, 2, 1, 1);
    await play(id, 3, 2, 2);
    const [room, score] = await duel.getMatchRoom(id);
    expect(room.phase).to.equal(3);
    expect(room.result).to.equal(0);
    expect(score.rounds).to.deep.equal([1n, 0n, 0n]);
    expect(await duel.getPlayerStats(a.address)).to.deep.equal([0n, 0n, 1n]);
    expect(await duel.getPlayerStats(b.address)).to.deep.equal([0n, 0n, 1n]);
  });

  it("rejects public and opponent decryption of move handles", async function () {
    const { address, a, b, blue, red, start, encrypt } = await fixture();
    const id = await start();
    const first = await encrypt(a, 2);
    const second = await encrypt(b, 1);
    await blue.submitMove(id, first.handles[0], first.inputProof);
    const firstHandle = ethers.hexlify(first.handles[0]);
    await assert.rejects(fhevm.publicDecrypt(first.handles));
    await assert.rejects(fhevm.userDecryptEuint(FhevmType.euint8, firstHandle, address, b));
    await red.submitMove(id, second.handles[0], second.inputProof);
    await assert.rejects(fhevm.publicDecrypt(first.handles));
    await assert.rejects(fhevm.publicDecrypt(second.handles));
    await assert.rejects(fhevm.userDecryptEuint(FhevmType.euint8, ethers.hexlify(second.handles[0]), address, a));
  });

  it("allows only the creator to cancel an unjoined lobby", async function () {
    const { duel, blue, red, open, start } = await fixture();
    const id = await open();
    await expect(red.cancelRoom(id)).to.be.revertedWithCustomError(duel, "NotCreator");
    await expect(blue.cancelRoom(id)).to.emit(duel, "RoomCancelled");
    expect((await duel.getRoom(id)).phase).to.equal(4);
    await expect(red.joinRoom(id)).to.be.revertedWithCustomError(duel, "WrongPhase");
    await expect(blue.cancelRoom(await start())).to.be.revertedWithCustomError(duel, "WrongPhase");
  });

  it("expires abandoned rooms but preserves finalization after both moves", async function () {
    const { duel, a, b, blue, red, visitor, open, start, submit, finish } = await fixture();
    const lobby = await open();
    const playing = await start();
    const ready = await start();
    await submit(ready, a, 1);
    await submit(ready, b, 1);
    await submit(playing, a, 0);
    await expect(visitor.expireRoom(lobby)).to.be.revertedWithCustomError(duel, "DeadlinePending");
    await time.increaseTo((await duel.getRoom(lobby)).joinDeadline);
    await expect(red.joinRoom(lobby)).to.be.revertedWithCustomError(duel, "DeadlinePassed");
    await expect(submit(playing, b, 0)).to.be.revertedWithCustomError(duel, "DeadlinePassed");
    await expect(visitor.expireRoom(lobby)).to.emit(duel, "RoomExpired");
    await visitor.expireRoom(playing);
    expect((await duel.getRoom(playing)).phase).to.equal(5);
    await expect(visitor.expireRoom(ready)).to.be.revertedWithCustomError(duel, "WrongPhase");
    await expect(blue.cancelRoom(ready)).to.be.revertedWithCustomError(duel, "WrongPhase");
    await finish(ready);
  });

  it("creates a fresh reserved rematch and paginates completed history", async function () {
    const { duel, a, blue, red, visitor, start, play } = await fixture();
    const id = await start();
    await expect(blue.createRematch(id)).to.be.revertedWithCustomError(duel, "WrongPhase");
    await play(id, 1, 0, 2);
    await play(id, 2, 1, 0);
    await expect(visitor.createRematch(id)).to.be.revertedWithCustomError(duel, "NotParticipant");
    await red.createRematch(id);
    const { rematchId } = await duel.getRoom(id);
    const next = await duel.getRoom(rematchId);
    expect(next.phase).to.equal(0);
    expect(next.submittedA || next.submittedB).to.equal(false);
    expect(next.encryptedResult).to.equal(ethers.ZeroHash);
    expect(rematchId >= 1000n && rematchId <= 9999n && rematchId !== id).to.equal(true);
    const [, rematchScore] = await duel.getMatchRoom(rematchId);
    expect(rematchScore.played).to.equal(0);
    await expect(visitor.joinRoom(rematchId)).to.be.revertedWithCustomError(duel, "CannotJoin");
    await expect(blue.createRematch(id)).to.be.revertedWithCustomError(duel, "RematchExists");
    await blue.joinRoom(rematchId);
    await play(rematchId, 1, 1, 0);
    await play(rematchId, 2, 2, 1);
    expect(await duel.getRecentMatches(a.address, 0, 1)).to.deep.equal([rematchId]);
    expect(await duel.getRecentMatches(a.address, 1, 20)).to.deep.equal([id]);
    expect(await duel.getRecentMatches(a.address, 2, 20)).to.deep.equal([]);
    await expect(duel.getRecentMatches(a.address, 0, 21)).to.be.revertedWithCustomError(duel, "PageTooLarge");
  });
});
