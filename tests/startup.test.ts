import { expect, test } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { connect, createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import type { Session } from "../src/shared/domain";

async function port() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Cannot allocate test port.");
  const value = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return value;
}
async function stop(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}
test("the host startup command displays network URLs and reopens its saved sessions", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "constellation-startup-"),
  );
  const hostPort = await port();
  const origin = `http://127.0.0.1:${hostPort}`;
  let output = "";
  let errors = "";
  const start = () => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/server/main.ts"],
      {
        env: {
          ...process.env,
          PORT: String(hostPort),
          SESSION_DIRECTORY: directory,
          REQUIRE_CODE_TO_JOIN_PROJECT: "false",
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      errors += data.toString();
    });
    return child;
  };
  let child = start();
  try {
    await expect
      .poll(() => output, { timeout: 8000, message: errors })
      .toContain("Constellation tracker:");
    await expect
      .poll(() => output, { timeout: 8000, message: errors })
      .toMatch(/Local network: http:\/\/\d+\.\d+\.\d+\.\d+:\d+/);
    const identity = (await (
      await fetch(`${origin}/api/editors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Startup editor" }),
      })
    ).json()) as { token: string };
    const headers = {
      authorization: `Bearer ${identity.token}`,
      "Content-Type": "application/json",
    };
    const created = (await (
      await fetch(`${origin}/api/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Portable session" }),
      })
    ).json()) as Session;
    expect(created.version).toBe(1);
    await stop(child);
    output = "";
    child = start();
    await expect
      .poll(() => output, { timeout: 8000 })
      .toContain("Constellation tracker:");
    const nextIdentity = (await (
      await fetch(`${origin}/api/editors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Startup editor" }),
      })
    ).json()) as { token: string };
    const reopened = (await (
      await fetch(`${origin}/api/sessions/${created.id}`, {
        headers: { authorization: `Bearer ${nextIdentity.token}` },
      })
    ).json()) as Session;
    expect(reopened).toEqual(created);
  } finally {
    await stop(child);
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);

test("SIGTERM exits while an idle speculative TCP connection remains open", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "constellation-shutdown-"),
  );
  const hostPort = await port();
  let output = "";
  const child = spawn(process.execPath, ["--import", "tsx", "src/server/main.ts"], {
    env: {
      ...process.env,
      PORT: String(hostPort),
      SESSION_DIRECTORY: directory,
      REQUIRE_CODE_TO_JOIN_PROJECT: "false",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => {
    output += data.toString();
  });
  let socket: ReturnType<typeof connect> | undefined;
  try {
    await expect
      .poll(() => output, { timeout: 8000 })
      .toContain("Constellation tracker:");
    socket = connect(hostPort, "127.0.0.1");
    socket.on("error", () => {});
    await once(socket, "connect");
    child.kill("SIGTERM");
    await expect
      .poll(() => child.exitCode !== null || child.signalCode !== null, {
        timeout: 3000,
      })
      .toBe(true);
  } finally {
    socket?.destroy();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
