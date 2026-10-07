import { expect, test, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildHost } from "../../src/server/host";
let host: Awaited<ReturnType<typeof buildHost>>;
let directory: string;
test.beforeAll(async ({ browser }, testInfo) => {
  console.log(
    `${testInfo.project.name}: ${browser.version()} on ${process.platform}`,
  );
  directory = await mkdtemp(path.join(os.tmpdir(), "constellation-browser-"));
  host = await buildHost({ directory, assets: path.resolve("dist") });
  await host.app.listen({ host: "127.0.0.1", port: 3211 });
});
test.afterAll(async () => {
  await host.app.close();
  await rm(directory, { recursive: true, force: true });
});

async function join(page: Page, name: string, origin = "/") {
  await page.goto(origin);
  await page.getByLabel("Editor display name").fill(name);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your sessions" }),
  ).toBeVisible();
}
async function create(page: Page, name: string) {
  await page.getByLabel("New session name").fill(name);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect(page.getByText(/Saved on host/)).toBeVisible();
}
async function assignment(page: Page, name: string, role: string) {
  await page
    .locator(".new-assignment")
    .getByLabel("Representative", { exact: true })
    .fill(name);
  await page
    .locator(".new-assignment")
    .getByLabel("Representing", { exact: true })
    .fill(role);
  await page.getByRole("button", { name: "Add assignment" }).click();
  await expect(
    page.locator(".piece-label").filter({ hasText: name }),
  ).toBeVisible();
}
test("two editors merge entry text, follow mentions, navigate independently and preserve offline drafts", async ({
  page,
  browser,
}) => {
  const second = await browser.newContext();
  const bob = await second.newPage();
  const name = `Shared session ${Date.now()}`;
  await join(page, "Pat");
  await create(page, name);
  await assignment(page, "Alice", "Mother");
  await join(bob, "Sam");
  await bob.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByText("Sam · Slide 1 · viewing together"),
  ).toBeVisible();
  await page.locator(".piece-label").dblclick();
  const composer = page.getByRole("textbox", { name: "New transcript entry" });
  await expect(composer).toBeFocused();
  await composer.fill("Mother is a word. ");
  await composer.press("End");
  await composer.press("@");
  await expect(
    page.getByRole("listbox", { name: "Assignment mentions" }),
  ).toBeVisible();
  await composer.press("Enter");
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(bob.locator(".entry")).toHaveCount(1);
  const entry1 = page.locator(".entry .tiptap"),
    entry2 = bob.locator(".entry .tiptap");
  await expect(entry1).toHaveAttribute("contenteditable", "true");
  await expect(entry2).toHaveAttribute("contenteditable", "true");
  await Promise.all([
    entry1.press("ControlOrMeta+End"),
    entry2.press("ControlOrMeta+End"),
  ]);
  await Promise.all([
    page.keyboard.insertText(" from Pat"),
    bob.keyboard.insertText(" from Sam"),
  ]);
  await expect(entry1).toContainText("from Pat");
  await expect(entry1).toContainText("from Sam");
  const entryText = (editorPage: Page) =>
    editorPage.locator(".entry .tiptap").evaluate((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(
          ".collaboration-carets__caret,.collaboration-carets__label",
        )
        .forEach((n) => n.remove());
      return clone.textContent;
    });
  await expect
    .poll(async () => (await entryText(page)) === (await entryText(bob)))
    .toBe(true);
  await expect(page.getByText(/Saved on host/)).toBeVisible();
  await expect(
    page.locator(".collaboration-carets__label").filter({ hasText: "Sam" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo text", exact: true }).click();
  await expect.poll(() => entryText(page)).not.toContain("from Pat");
  await expect.poll(() => entryText(page)).toContain("from Sam");
  await page.getByRole("button", { name: "Redo text", exact: true }).click();
  await expect.poll(() => entryText(bob)).toContain("from Pat");
  const representation = page
    .locator(".piece-controls")
    .getByLabel("Representing", { exact: true });
  await representation.fill("Parent");
  await representation.press("Enter");
  await expect(bob.locator(".entry-heading strong")).toHaveText(
    "Alice (Parent)",
  );
  await expect(entry2.locator(".mention")).toHaveText("@Alice (Parent)");
  await expect(entry2).toContainText("Mother is a word.");
  await bob
    .getByLabel("Filter by assignment")
    .selectOption({ label: "Alice (Parent)" });
  await expect(bob.locator(".entry")).toHaveCount(1);
  await expect(
    bob.getByText("Spoken by · Mentioned", { exact: true }),
  ).toBeVisible();
  await bob.getByLabel("Filter by assignment").selectOption("");
  await bob.getByLabel("My labels").selectOption("representative");
  await expect(bob.locator(".entry-heading strong")).toHaveText("Alice");
  await expect(page.locator(".entry-heading strong")).toHaveText(
    "Alice (Parent)",
  );
  await page.getByRole("button", { name: "Snapshot / new slide" }).click();
  await expect(page.locator(".entry")).toHaveCount(0);
  await expect(bob.locator(".entry")).toHaveCount(1);
  await expect(bob.getByText("Pat · Slide 2")).toBeVisible();
  await composer.fill("Unfinished on slide two");
  await page.context().setOffline(true);
  await expect(
    page.getByText("Disconnected · shared editing paused"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save entry", exact: true }),
  ).toBeDisabled();
  await expect(composer).toHaveText("Unfinished on slide two");
  await page.context().setOffline(false);
  await expect(page.getByText(/Saved on host/)).toBeVisible();
  await expect(composer).toHaveText("Unfinished on slide two");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(page.getByText(/Saved on host/)).toBeVisible();
  await host.app.close();
  await expect(
    page.getByText("Disconnected · shared editing paused"),
  ).toBeVisible();
  host = await buildHost({ directory, assets: path.resolve("dist") });
  await host.app.listen({ host: "127.0.0.1", port: 3211 });
  await expect(page.getByText(/Saved on host/)).toBeVisible();
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(page.locator(".entry .tiptap")).toHaveText(
    "Unfinished on slide two",
  );
  await expect(page.locator(".entry .tiptap")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await page.getByRole("button", { name: "Sessions", exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await second.close();
});
test("shape, facing, linked filters, saved files, backup and print workflow", async ({
  page,
}, testInfo) => {
  await join(page, "Editor");
  await create(page, `Geometry ${Date.now()}`);
  await assignment(page, "Alice", "Fear");
  await page
    .getByRole("combobox", { name: "Shape", exact: true })
    .selectOption("triangle");
  await expect(page.locator(".board path").first()).toHaveAttribute(
    "d",
    "M 0 -36 L 34 26 H -34 Z",
  );
  await page.getByLabel("Facing angle").fill("37.5");
  await page.getByLabel("Facing angle").press("Enter");
  await expect(page.locator(".board g[role=button]")).toHaveAttribute(
    "transform",
    "rotate(37.5)",
  );
  await page.getByRole("button", { name: "Clockwise", exact: true }).click();
  await expect(page.getByLabel("Facing angle")).toHaveValue("42.5");
  await page
    .getByRole("combobox", { name: "Shape", exact: true })
    .selectOption("square");
  await expect(page.locator(".board path").first()).toHaveAttribute(
    "d",
    "M -29 -29 H 29 V 29 H -29 Z",
  );
  const body = await page
    .locator(".board g[role=button] path")
    .first()
    .boundingBox();
  const handle = await page.locator(".rotation-handle circle").boundingBox();
  if (!body || !handle) throw new Error("Rotation geometry is not visible.");
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    body.x + body.width / 2 + 80,
    body.y + body.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Facing angle")).toHaveValue("90");
  await page.locator(".piece-label").dblclick();
  await page
    .getByRole("textbox", { name: "New transcript entry" })
    .fill("A thought");
  await page
    .getByRole("textbox", { name: "New transcript entry" })
    .press("Enter");
  await expect(page.getByText("Markdown & PNG ready")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("editor-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({
    path: testInfo.outputPath("editor-laptop.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Filter by assignment")
    .selectOption({ label: "Alice (Fear)" });
  await expect(page.getByText("Spoken by", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toMatch(/constellation-.*\.json/);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-session")).toBeVisible();
  await expect(page.locator(".workspace")).toBeHidden();
  await expect(page.locator(".print-session")).toContainText("Alice (Fear)");
  await expect(page.locator(".print-session")).toContainText("A thought");
});
test("distinct role assignments, removal and slide deletion preserve identities and local drafts", async ({
  page,
  browser,
}) => {
  const second = await browser.newContext();
  const bob = await second.newPage();
  const name = `Roles ${Date.now()}`;
  await join(page, "Pat");
  await create(page, name);
  await assignment(page, "Alice", "Mother");
  await page
    .locator(".new-assignment")
    .getByLabel("Representative", { exact: true })
    .fill("Alice");
  await page
    .locator(".new-assignment")
    .getByLabel("Representing", { exact: true })
    .fill("Fear");
  await page.getByRole("button", { name: "Add assignment" }).click();
  await expect(page.locator(".piece-label")).toHaveText([
    "Alice 1 (Mother)",
    "Alice 2 (Fear)",
  ]);
  await join(bob, "Sam");
  await bob.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Snapshot / new slide" }).click();
  await expect(page.locator(".piece-label")).toHaveCount(2);
  await expect(page.locator(".entry")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Speak as Alice 2 (Fear)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from this slide", exact: true })
    .click();
  await expect(page.locator(".piece-label")).toHaveCount(1);
  const fear = page.locator("tbody tr").filter({ hasText: "Alice 2 (Fear)" });
  await expect(fear).toContainText("1");
  await fear.getByRole("button", { name: "Add to slide" }).click();
  await expect(page.locator(".piece-label")).toHaveCount(2);
  await bob.getByRole("button", { name: "Next", exact: true }).click();
  await bob
    .getByRole("textbox", { name: "New transcript entry" })
    .fill("A draft for a deleted stage");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete slide", exact: true }).click();
  await expect(
    bob.getByText(
      "The slide was deleted. Any unfinished text is in Local drafts.",
    ),
  ).toBeVisible();
  await bob.getByRole("button", { name: "Local drafts", exact: true }).click();
  await expect(bob.locator(".draft-list")).toContainText(
    "A draft for a deleted stage",
  );
  await expect(bob.locator("tbody tr")).toHaveCount(2);
  await second.close();
});
test("a plain HTTP network origin supports assignment creation without secure-context APIs", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await join(page, "LAN editor", "http://constellation.test:3211");
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
  await create(page, `LAN ${Date.now()}`);
  await assignment(page, "Alice", "");
  await page.locator(".piece-label").dblclick();
  await page
    .getByRole("textbox", { name: "New transcript entry" })
    .fill("Network note");
  await page
    .getByRole("textbox", { name: "New transcript entry" })
    .press("Enter");
  await expect(page.locator(".entry .tiptap")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(page.locator(".entry .tiptap")).toHaveText("Network note");
  expect(
    requests.every((url) => new URL(url).hostname === "constellation.test"),
  ).toBe(true);
});
