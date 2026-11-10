import { expect, test } from "@playwright/test";
import { encodeFunctionResult, toFunctionSelector, zeroHash } from "viem";
import { duelAbi } from "../lib/duel-abi";

const a = "0x0000000000000000000000000000000000000001";
const b = "0x0000000000000000000000000000000000000002";

test("renders the landing page on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Secret Panda Duel." })).toBeVisible();
  await expect(page.getByRole("img", { name: "Panda Blue" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Panda Red" })).toBeVisible();
  if (process.env.CAPTURE_DOJO) await page.screenshot({ path: "docs/screenshots/dojo-desktop.png", fullPage: true, animations: "disabled" });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "Enter the dojo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  if (process.env.CAPTURE_DOJO) await page.screenshot({ path: "docs/screenshots/dojo-mobile.png", fullPage: true, animations: "disabled" });
  await page.getByRole("link", { name: "Enter the dojo" }).click();
  await expect(page.getByRole("heading", { name: "Take your seat." })).toBeVisible();
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByRole("banner").getByRole("alert")).toContainText("MetaMask isn’t available in this browser.");
  await expect(page.getByRole("button", { name: "Copy game link" })).toBeVisible();
});

for (const version of [1, 2]) test(`restores wallet and confirmed move state after reloading a V${version} invitation`, async ({ page }) => {
  await page.addInitScript((player) => {
    const ethereum = {
      isMetaMask: true,
      on() {},
      removeListener() {},
      request: async ({ method }: { method: string }) => {
        if (method === "eth_chainId") return localStorage.getItem("test-chain") ?? "0xaa36a7";
        if (method === "wallet_switchEthereumChain") {
          localStorage.setItem("test-chain", "0xaa36a7");
          return null;
        }
        if (method === "eth_requestAccounts") localStorage.setItem("test-wallet", "authorized");
        if (method === "eth_accounts" || method === "eth_requestAccounts") {
          return localStorage.getItem("test-wallet") ? [player] : [];
        }
        throw new Error(`Unexpected wallet call ${method}`);
      },
    };
    Object.defineProperty(window, "ethereum", { value: ethereum });
  }, a);

  let submittedA = false;
  let roomReads = 0;
  await page.route("**/test-rpc", async route => {
    const request = route.request().postDataJSON();
    if (request.method === "eth_call") {
      const data = request.params[0].data;
      const selector = data.slice(0, 10);
      let result;
      if (selector === toFunctionSelector("GAME_VERSION()")) {
        if (version === 1) {
          await route.fulfill({ json: {
            jsonrpc: "2.0", id: request.id, error: { code: 3, message: "execution reverted", data: "0x" },
          } });
          return;
        }
        result = encodeFunctionResult({ abi: duelAbi, functionName: "GAME_VERSION", result: 2 });
      } else if (selector === toFunctionSelector("roomCount()")) {
        result = encodeFunctionResult({ abi: duelAbi, functionName: "roomCount", result: 7n });
      } else if (selector === toFunctionSelector("usernames(address)")) {
        result = encodeFunctionResult({ abi: duelAbi, functionName: "usernames", result: data.endsWith(a.slice(2)) ? "BluePanda" : "RedPanda" });
      } else {
        roomReads++;
        const room = {
          playerA: a, playerB: b, invitedOpponent: "0x0000000000000000000000000000000000000000",
          phase: 1, result: 0, submittedA, submittedB: false, createdAt: 1_000n,
          joinDeadline: 2_800n, moveDeadline: 2_000n, endedAt: 0n, rematchId: 0n, encryptedResult: zeroHash,
        } as const;
        result = version === 1
          ? encodeFunctionResult({ abi: duelAbi, functionName: "getRoom", result: room })
          : encodeFunctionResult({ abi: duelAbi, functionName: "getMatchRoom", result: [
            room, { played: 1, winsA: 1, winsB: 0, rounds: [1, 0, 0] },
          ] });
      }
      await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, result } });
    } else if (request.method === "eth_getBlockByNumber") {
      await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: { timestamp: "0x401" } } });
    } else {
      await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Unsupported in test fixture" } } });
    }
  });

  if (version === 2) {
    await page.goto("/play");
    await expect(page.getByRole("heading", { name: "Choose your username" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save username" })).toBeDisabled();
  }
  await page.goto(version === 1 ? "/room/7" : "/room/4821");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByRole("heading", { name: "Choose your move." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rock Beats scissors" })).toBeEnabled();
  submittedA = true;
  const readsBeforeReload = roomReads;

  await page.reload();
  await expect(page.getByRole("heading", { name: "Waiting for your opponent." })).toBeVisible();
  await expect(page.getByText("01 / PANDA BLUE · YOU")).toBeVisible();
  await expect(page.getByText("Encrypted move locked")).toBeVisible();
  if (version === 2) {
    await expect(page.getByText("BluePanda", { exact: true })).toBeVisible();
    await expect(page.getByText("RedPanda", { exact: true })).toBeVisible();
    await expect(page.getByText("ROUND 2 / 3", { exact: false })).toBeVisible();
    await expect(page.getByText("Blue 1 – 0 Red")).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Rock Beats scissors" })).toHaveCount(0);
  expect(roomReads).toBeGreaterThan(readsBeforeReload);
  if (version === 2) {
    await page.goto("/play");
    await page.getByLabel("3–20 letters, digits, or underscores").fill("Blue_Panda");
    const save = page.getByRole("button", { name: "Save username" });
    await expect(save).toBeEnabled();
    // Simulate a network change that does not emit a chainChanged event.
    await page.evaluate(() => localStorage.setItem("test-chain", "0x3e7"));
    await expect(save).toBeDisabled({ timeout: 8_000 });
    await page.getByRole("button", { name: "Switch to Sepolia" }).click();
    await expect(save).toBeEnabled();
  }
});
