import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const artifact = JSON.parse(await readFile(new URL(
  "../packages/contracts/artifacts/contracts/SecretPandaDuel.sol/SecretPandaDuel.json", import.meta.url,
)));
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) });
const port = 3016;
const origin = `http://127.0.0.1:${port}`;
const page = `<!doctype html>
<html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deploy Secret Panda Duel</title>
<style>
body{background:#100f22;color:#f8f3ff;font:17px system-ui;margin:10vh auto;padding:0 20px;max-width:630px}
main{background:#19172e;border:1px solid #393552;border-radius:20px;padding:28px}
button{background:#ffe57b;color:#211b2c;border:0;border-radius:8px;padding:12px;font:inherit;font-weight:bold;cursor:pointer}
button:disabled{opacity:.5;cursor:wait} p{line-height:1.55} pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#83f1df}
a{color:#83f1df}
</style>
<main><h1>Deploy Secret Panda Duel</h1>
<p>Dùng ví MetaMask dành riêng cho testnet và có Sepolia ETH. Trang này chỉ yêu cầu một giao dịch tạo contract trên Ethereum Sepolia.</p>
<button id="deploy">Deploy qua MetaMask</button><pre id="status" role="status"></pre>
<a id="explorer" target="_blank" rel="noreferrer" hidden>Xem giao dịch trên Sepolia Etherscan ↗</a></main>
<script>
const button = document.getElementById("deploy");
const status = document.getElementById("status");
const explorer = document.getElementById("explorer");
button.onclick = async () => {
  button.disabled = true;
  let hash;
  try {
    const injected = window.ethereum;
    const wallet = injected?.providers?.find(provider => provider.isMetaMask) ?? injected;
    if (!wallet?.isMetaMask) throw new Error("Mở trang này trong trình duyệt có MetaMask.");
    const request = (method, params = []) => wallet.request({ method, params });
    const [from] = await request("eth_requestAccounts");
    if (await request("eth_chainId") !== "0xaa36a7") {
      await request("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
    }
    if (await request("eth_chainId") !== "0xaa36a7") throw new Error("Hãy chuyển sang Ethereum Sepolia.");
    if (BigInt(await request("eth_getBalance", [from, "latest"])) === 0n) {
      throw new Error("Ví " + from + " chưa có Sepolia ETH để trả gas.");
    }
    const [active] = await request("eth_accounts");
    if (active?.toLowerCase() !== from.toLowerCase()) throw new Error("Tài khoản đã đổi. Hãy thử lại.");
    status.textContent = "Kiểm tra tài khoản và phí Sepolia trong MetaMask, rồi xác nhận giao dịch.";
    hash = await request("eth_sendTransaction", [{ from, data: ${JSON.stringify(artifact.bytecode)}, value: "0x0", chainId: "0xaa36a7" }]);
    explorer.href = "https://sepolia.etherscan.io/tx/" + hash;
    explorer.hidden = false;
    status.textContent = "Đã gửi " + hash + ". Đang chờ hai xác nhận…";
    const response = await fetch("/verify/" + hash, { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    status.textContent = "Đã xác minh bytecode trên Sepolia. Địa chỉ contract: " + result.address;
  } catch (error) {
    status.textContent = error.message + (hash ? "\\nGiao dịch: " + hash : "");
    if (!hash) button.disabled = false;
  }
};
</script>`;

async function verify(hash) {
  if (await client.getChainId() !== sepolia.id) throw new Error("RPC không kết nối Sepolia.");
  console.log("Deployment transaction submitted:", hash);
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 300_000 });
  const { contractAddress: address, blockNumber } = receipt;
  if (receipt.status !== "success" || !address) throw new Error("Giao dịch không tạo được contract.");
  const tx = await client.getTransaction({ hash: receipt.transactionHash });
  if (tx.to !== null || tx.input !== artifact.bytecode) throw new Error("Giao dịch không khớp bytecode deploy.");
  if (await client.getCode({ address, blockNumber }) !== artifact.deployedBytecode) {
    throw new Error("Bytecode tại địa chỉ đã deploy không khớp artifact.");
  }
  const result = { address, chainId: sepolia.id, hash: receipt.transactionHash, blockNumber: blockNumber.toString() };
  await writeFile(new URL("../.sepolia-wallet-deploy.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log("Verified deployment:", JSON.stringify(result));
  return result;
}

const hash = process.argv[2];
if (hash) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Invalid transaction hash.");
  await verify(hash);
} else {
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end(); return; }
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
      return;
    }
    const match = req.url?.match(/^\/verify\/(0x[0-9a-f]{64})$/i);
    if (req.method !== "POST" || req.headers.origin !== origin || !match) {
      res.writeHead(404).end();
      return;
    }
    try {
      const result = await verify(match[1]);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error.shortMessage ?? error.message }));
    }
  });
  server.listen(port, "127.0.0.1", () => console.log(`Open ${origin} in the browser with MetaMask.`));
}
