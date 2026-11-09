import { expect, test } from "@playwright/test";
import { encodeFunctionResult, zeroHash } from "viem";
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
});

test("restores wallet and confirmed move state after reloading the invitation", async ({ page }) => {
  await page.addInitScript((player) => {
    const ethereum = {
      isMetaMask: true,
      on() {},
      removeListener() {},
      request: async ({ method }: { method: string }) => {
        if (method === "eth_chainId") return "0xaa36a7";
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
      roomReads++;
      const result = encodeFunctionResult({
        abi: duelAbi, functionName: "getRoom",
        result: {
          playerA: a, playerB: b, invitedOpponent: "0x0000000000000000000000000000000000000000",
          phase: 1, result: 0, submittedA, submittedB: false, createdAt: 1_000n,
          joinDeadline: 2_800n, moveDeadline: 2_000n, endedAt: 0n, rematchId: 0n, encryptedResult: zeroHash,
        },
      });
      await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, result } });
    } else if (request.method === "eth_getBlockByNumber") {
      await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, result: { timestamp: "0x401" } } });
    } else {
      await route.fulfill({ json: { jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Unsupported in test fixture" } } });
    }
  });

  await page.goto("/room/7");
  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByRole("heading", { name: "Choose your move." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rock Beats scissors" })).toBeEnabled();
  submittedA = true;
  const readsBeforeReload = roomReads;

  await page.reload();
  await expect(page.getByRole("heading", { name: "Waiting for your opponent." })).toBeVisible();
  await expect(page.getByText("01 / PANDA BLUE · YOU")).toBeVisible();
  await expect(page.getByText("Encrypted move locked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rock Beats scissors" })).toHaveCount(0);
  expect(roomReads).toBeGreaterThan(readsBeforeReload);
});
