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
    await blue.createRoom();
    return await duel.roomCount() as bigint;
  }

  async function start() {
    const id = await open();
    await red.joinRoom(id);
    return id;
  }

  function encrypt(player: typeof a, move: number) {
    return fhevm.createEncryptedInput(address, player.address).add8(move).encrypt();
  }

  async function submit(id: bigint, player: typeof a, move: number) {
    const { handles: [handle], inputProof } = await encrypt(player, move);
    return as(player).submitMove(id, handle, inputProof);
  }

  async function proof(id: bigint) {
    const { encryptedResult } = await duel.getRoom(id);
    const data = await fhevm.publicDecrypt([encryptedResult]);
    return [data.clearValues[encryptedResult], data.decryptionProof] as const;
  }

  async function finish(id: bigint) {
    await visitor.finalizeRound(id, ...await proof(id));
  }

  return { duel, address, a, b, guest, blue, red, visitor, open, start, encrypt, submit, proof, finish };
}

describe("SecretPandaDuel with official FHEVM helpers", function () {
  it("assigns unique IDs and restricts joining", async function () {
    const { duel, a, b, blue, red, visitor, open } = await fixture();
    await expect(blue.createRoom()).to.emit(duel, "RoomCreated").withArgs(1, a.address, ethers.ZeroAddress);
    expect(await open()).to.equal(2);
    await expect(duel.getRoom(3)).to.be.revertedWithCustomError(duel, "RoomNotFound");
    await expect(blue.joinRoom(1)).to.be.revertedWithCustomError(duel, "CannotJoin");
    await expect(red.joinRoom(1)).to.emit(duel, "RoomJoined").withArgs(1, b.address);
    await expect(visitor.joinRoom(1)).to.be.revertedWithCustomError(duel, "WrongPhase");
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
      const complete = await duel.getRoom(id);
      expect(complete.phase).to.equal(3);
      expect(complete.result).to.equal(expected);
      expect(await duel.getPlayerStats(a.address)).to.deep.equal([BigInt(expected === 1), BigInt(expected === 2), BigInt(expected === 0)]);
      expect(await duel.getPlayerStats(b.address)).to.deep.equal([BigInt(expected === 2), BigInt(expected === 1), BigInt(expected === 0)]);
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
    const { duel, a, b, blue, red, visitor, start, submit, finish } = await fixture();
    const id = await start();
    await expect(blue.createRematch(id)).to.be.revertedWithCustomError(duel, "WrongPhase");
    await submit(id, a, 0);
    await submit(id, b, 0);
    await finish(id);
    await expect(visitor.createRematch(id)).to.be.revertedWithCustomError(duel, "NotParticipant");
    await red.createRematch(id);
    const { rematchId } = await duel.getRoom(id);
    const next = await duel.getRoom(rematchId);
    expect(next.phase).to.equal(0);
    expect(next.submittedA || next.submittedB).to.equal(false);
    expect(next.encryptedResult).to.equal(ethers.ZeroHash);
    await expect(visitor.joinRoom(rematchId)).to.be.revertedWithCustomError(duel, "CannotJoin");
    await expect(blue.createRematch(id)).to.be.revertedWithCustomError(duel, "RematchExists");
    await blue.joinRoom(rematchId);
    await submit(rematchId, b, 1);
    await submit(rematchId, a, 0);
    await finish(rematchId);
    expect(await duel.getRecentMatches(a.address, 0, 1)).to.deep.equal([rematchId]);
    expect(await duel.getRecentMatches(a.address, 1, 20)).to.deep.equal([id]);
    expect(await duel.getRecentMatches(a.address, 2, 20)).to.deep.equal([]);
    await expect(duel.getRecentMatches(a.address, 0, 21)).to.be.revertedWithCustomError(duel, "PageTooLarge");
  });
});
