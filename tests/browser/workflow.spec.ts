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
  const pieceCount = await page.locator(".piece-label").count();
  await page
    .locator(".new-assignment")
    .getByLabel("Representative", { exact: true })
    .fill(name);
  await page
    .locator(".new-assignment")
    .getByLabel("Representing", { exact: true })
    .fill(role);
  await page.getByRole("button", { name: "Add assignment" }).click();
  await expect(page.locator(".piece-label")).toHaveCount(pieceCount + 1);
  await expect(
    page.locator(".piece-label").filter({ hasText: name }).last(),
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

test("dropdown stays anchored through viewport changes, dismisses on focus loss and explains empty states", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await join(page, "Design regression editor");
  await create(page, `Dropdown design ${Date.now()}`);
  await assignment(page, "Alice", "Mother");
  const composer = page.getByRole("textbox", { name: "New transcript entry" });
  const placeholder = page.locator(".composer-placeholder");
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toHaveAttribute("aria-hidden", "true");
  await expect(composer).toHaveAttribute(
    "aria-placeholder",
    "Record what was said.",
  );
  await composer.pressSequentially("@Alice");
  await expect(placeholder).toHaveCount(0);
  const menu = page.getByRole("listbox", { name: "Assignment mentions" });
  await expect(menu.getByRole("option")).toHaveCount(1);
  await expect(composer).toHaveAttribute("aria-autocomplete", "list");
  await expect(composer).toHaveAttribute("aria-haspopup", "listbox");
  await page.screenshot({ path: testInfo.outputPath("critique-desktop.png") });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect
    .poll(() => menu.evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(1012);
  await page.evaluate(() => window.scrollBy(0, 60));
  const anchor = composer.locator("[data-decoration-id]");
  await expect
    .poll(async () => {
      const popup = await menu.boundingBox();
      const caret = await anchor.boundingBox();
      if (!popup || !caret) return Infinity;
      return Math.min(
        Math.abs(popup.y - caret.y - caret.height),
        Math.abs(popup.y + popup.height - caret.y),
      );
    })
    .toBeLessThanOrEqual(8);
  await page.screenshot({ path: testInfo.outputPath("critique-laptop.png") });
  await composer.press("Tab");
  await expect(
    page.getByRole("button", { name: "Save entry", exact: true }),
  ).toBeFocused();
  await expect(menu).toHaveCount(0);
  await expect(composer).not.toHaveAttribute("aria-controls", /.+/);
  await expect(composer).not.toHaveAttribute("aria-activedescendant", /.+/);
  await expect(composer).toHaveText("@Alice");
  await composer.click();
  await composer.press("ControlOrMeta+A");
  await composer.press("Backspace");
  await expect(placeholder).toBeVisible();
  await composer.pressSequentially("@Unknown");
  await expect(menu).toContainText("No matching assignments");
  await expect(
    page.getByRole("status").filter({ hasText: "No matching assignments" }),
  ).toHaveCount(1);
  await expect(page.locator(".mention-menu-hint")).not.toContainText(
    "Enter to select",
  );
  await composer.press("Escape");
  await composer.press("ControlOrMeta+A");
  await composer.press("Backspace");
  await composer.pressSequentially("@Alice");
  await expect(menu.getByRole("option")).toHaveCount(1);
  const choice = menu.getByRole("option").first();
  await expect(choice).toHaveAttribute("tabindex", "-1");
  await choice.evaluate((el: HTMLButtonElement) => el.click());
  await expect(menu).toHaveCount(0);
  await expect(composer.locator("[data-assignment-id]")).toHaveCount(1);
  await composer.press(":");
  await expect(
    page.locator(".composer").getByRole("combobox").locator("option:checked"),
  ).toHaveText("Alice (Mother)");
});

test("representative and representation dropdowns support arrow selection, facilitator and long lists", async ({
  page,
}, testInfo) => {
  await join(page, "Keyboard editor");
  await create(page, `Dropdown ${Date.now()}`);
  await assignment(page, "Alice", "Mother");
  await assignment(page, "Alice", "Fear");
  await assignment(page, "Cara", "Inner child");
  const composer = page.getByRole("textbox", { name: "New transcript entry" });
  const speaker = page.locator(".composer").getByRole("combobox");
  const menu = page.getByRole("listbox", { name: "Assignment mentions" });
  await composer.press("@");
  await expect(
    menu.getByRole("option", { name: "Facilitator", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await composer.press("Enter");
  await composer.press(":");
  await expect(speaker).toHaveValue("facilitator");
  await expect(composer).toHaveText("");
  await composer.pressSequentially("@Alice");
  await expect(menu.getByRole("option")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("dropdown-desktop.png") });
  await composer.press("ArrowDown");
  await expect(
    menu.getByRole("option", { name: "Alice 2 (Fear)" }),
  ).toHaveAttribute("aria-selected", "true");
  await composer.press("ArrowUp");
  await expect(
    menu.getByRole("option", { name: "Alice 1 (Mother)" }),
  ).toHaveAttribute("aria-selected", "true");
  await composer.press("Enter");
  await composer.press(":");
  await expect(speaker.locator("option:checked")).toHaveText(
    "Alice 1 (Mother)",
  );
  await page.setViewportSize({ width: 1024, height: 768 });
  await composer.pressSequentially("@Fear");
  await expect(menu.getByRole("option")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("dropdown-laptop.png") });
  await composer.press("Enter");
  await composer.press(":");
  await expect(speaker.locator("option:checked")).toHaveText("Alice 2 (Fear)");
  await composer.pressSequentially("@Inner child");
  await expect(
    menu.getByRole("option", { name: "Cara (Inner child)" }),
  ).toBeVisible();
  await composer.press("Enter");
  await composer.press(":");
  await expect(speaker.locator("option:checked")).toHaveText(
    "Cara (Inner child)",
  );
  await composer.pressSequentially("@Unknown");
  await expect(menu).toContainText("No matching assignments");
  await composer.press("Escape");
  await expect(menu).toHaveCount(0);
  await composer.press("ControlOrMeta+A");
  await composer.press("Backspace");
  await expect(composer).toHaveText("");
  for (let i = 1; i <= 11; i++)
    await assignment(page, `Guest ${i}`, `Role ${i}`);
  await composer.click();
  await composer.press("@");
  await expect(menu.getByRole("option")).toHaveCount(15);
  await composer.press("ArrowUp");
  const last = menu.getByRole("option", { name: "Guest 11 (Role 11)" });
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(last).toBeInViewport();
  await page.setViewportSize({ width: 1024, height: 480 });
  await expect(last).toBeInViewport();
  await expect
    .poll(() => menu.evaluate((el) => el.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(468);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({
    path: testInfo.outputPath("dropdown-long-list.png"),
  });
  await expect(composer).toBeFocused();
  await composer.press("Enter");
  await composer.press(":");
  await expect(speaker.locator("option:checked")).toHaveText(
    "Guest 11 (Role 11)",
  );
  await composer.pressSequentially("Last assignment speaks");
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(page.locator(".entry")).toContainText("Guest 11 (Role 11)");
});

test("leading colon shortcuts select speakers while inline mentions and ambiguous names retain their identities", async ({
  page,
}) => {
  await join(page, "Note taker");
  await create(page, `Speaker shortcuts ${Date.now()}`);
  await assignment(page, "Alice", "Mother");
  const composer = page.getByRole("textbox", { name: "New transcript entry" });
  const speaker = page.locator(".composer").getByRole("combobox");
  await composer.pressSequentially("@facilitator:");
  await expect(speaker).toHaveValue("facilitator");
  await expect(composer).toHaveText("");
  await composer.pressSequentially("Welcome");
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(page.locator(".entry").first()).toContainText("Facilitator");
  await composer.pressSequentially("@Alice:");
  await expect(speaker.locator("option:checked")).toHaveText("Alice (Mother)");
  await composer.pressSequentially("I feel calm");
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(2);
  await expect(page.locator(".entry").nth(1)).toContainText("Alice (Mother)");
  await expect(page.locator(".entry .tiptap").nth(1)).toHaveText("I feel calm");

  await assignment(page, "Alice", "Fear");
  await composer.fill("@Alice: ambiguous");
  await expect(speaker.locator("option:checked")).toHaveText(
    "Alice 1 (Mother)",
  );
  await expect(composer).toHaveText("@Alice: ambiguous");
  await composer.fill("@Alice 2: I feel afraid");
  await expect(speaker.locator("option:checked")).toHaveText("Alice 2 (Fear)");
  await expect(composer).toHaveText("I feel afraid");
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(3);

  await composer.press("@");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "Alice 1 (Mother)", exact: true })
    .click();
  await composer.press(":");
  await expect(speaker.locator("option:checked")).toHaveText(
    "Alice 1 (Mother)",
  );
  await expect(composer).toHaveText("");
  await composer.pressSequentially("Speaking about ");
  await composer.press("@");
  await page
    .getByRole("listbox")
    .getByRole("option", { name: "Alice 2 (Fear)", exact: true })
    .click();
  await composer.press(":");
  await expect(speaker.locator("option:checked")).toHaveText(
    "Alice 1 (Mother)",
  );
  await expect(composer.locator("[data-assignment-id]")).toHaveCount(1);
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(4);
  await expect(
    page.locator(".entry .tiptap").last().locator("[data-assignment-id]"),
  ).toHaveCount(1);
  await expect(page.getByText(/Saved on host/)).toBeVisible();
});

test("lost creation response survives remount and reconciles without duplicating speech", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { pauseReceipts: false });
    const descriptor = Object.getOwnPropertyDescriptor(
      WebSocket.prototype,
      "onmessage",
    )!;
    Object.defineProperty(WebSocket.prototype, "onmessage", {
      ...descriptor,
      set(handler) {
        descriptor.set!.call(this, (event: MessageEvent) => {
          if (
            Reflect.get(window, "pauseReceipts") &&
            typeof event.data === "string" &&
            JSON.parse(event.data).type === "saved"
          )
            return;
          handler?.call(this, event);
        });
      },
    });
  });
  const name = `Lost response ${Date.now()}`;
  await join(page, "Pat");
  await create(page, name);
  await page.getByRole("button", { name: "Snapshot / new slide" }).click();
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "New transcript entry" });
  await composer.fill("Saved once despite losing the response");
  await page.evaluate(() => Reflect.set(window, "pauseReceipts", true));
  let savedId = "";
  await page.route("**/commands", async (route) => {
    if (route.request().postDataJSON().type !== "entry.create")
      return route.continue();
    const response = await route.fetch(); // Real host persists before the response is dropped.
    expect(response.ok()).toBeTruthy();
    savedId = (await response.json()).slides[0].entries[0].id;
    await route.abort("failed");
  });
  await composer.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Failed to fetch");
  const draft = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("constellation:draft:"))
      .map((key) => JSON.parse(localStorage.getItem(key)!))
      .find((draft) => draft.target.startsWith("composer-")),
  );
  expect(JSON.stringify(draft.text)).toContain(
    "Saved once despite losing the response",
  );
  await page.unroute("**/commands");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(composer).toHaveText("Saved once despite losing the response");
  const retry = page.waitForRequest((request) =>
    request.url().endsWith("/commands"),
  );
  await composer.press("Enter");
  expect((await retry).postDataJSON().id).toBe(savedId);
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(composer).toHaveText("");
  await join(page, "Pat"); // Reload destroys the composer and its in-memory ID.
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect(page.locator(".entry")).toHaveAttribute(
    "data-entry-id",
    savedId,
  );
  await expect(composer).toHaveText("");
  await composer.press("Enter");
  await expect(page.locator(".entry")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith("constellation:draft:"))
          .map((key) => JSON.parse(localStorage.getItem(key)!))
          .filter((draft) => draft.pendingCreation),
      ),
    )
    .toEqual([]);
});

test("recovering a draft archives the unfinished composer and its attribution", async ({
  page,
}) => {
  await join(page, "Editor");
  await create(page, `Recovery ${Date.now()}`);
  await assignment(page, "Alice", "Mother");
  const composer = page.getByRole("textbox", { name: "New transcript entry" });
  await composer.fill("Original general note");
  await page.locator(".piece-label").dblclick(); // Archive the first draft.
  await composer.fill("Alice's unfinished speech");
  await page.getByRole("button", { name: "Local drafts", exact: true }).click();
  await page
    .locator(".draft-list article")
    .filter({ hasText: "Original general note" })
    .getByRole("button", { name: "Recover into composer" })
    .click();
  await expect(composer).toHaveText("Original general note");
  await expect(page.locator(".composer select")).toHaveValue("");
  const drafts = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("constellation:draft:"))
      .map((key) => JSON.parse(localStorage.getItem(key)!)),
  );
  const displaced = drafts.find((draft) =>
    JSON.stringify(draft.text).includes("Alice's unfinished speech"),
  );
  expect(displaced).toBeDefined();
  expect(displaced.target).toMatch(/^recovered-/);
  expect(displaced.speaker).toBeTruthy();
  expect(
    drafts.find((draft) => draft.target.startsWith("composer-")).speaker,
  ).toBeNull();
  await composer.press("Enter");
  await expect(page.locator(".entry-heading strong")).toHaveText(
    "General note",
  );
  await page.getByRole("button", { name: "Local drafts", exact: true }).click();
  await page.getByRole("button", { name: "Local drafts", exact: true }).click();
  await expect(page.locator(".draft-list")).toContainText(
    "Alice's unfinished speech",
  );
});

test("rotation handles reach unrestricted angles at all four board edges", async ({
  page,
}) => {
  await join(page, "Editor");
  await create(page, `Edge rotation ${Date.now()}`);
  const requestPromise = page.waitForRequest((request) =>
    request.url().endsWith("/commands"),
  );
  await assignment(page, "Alice", "Mother");
  const request = await requestPromise;
  const command = request.postDataJSON();
  const headers = { authorization: request.headers().authorization };
  for (const edge of [
    {
      position: { x: 40, y: 300 },
      initial: 90,
      target: { x: -10, y: 300 },
      angle: -90,
    },
    {
      position: { x: 960, y: 300 },
      initial: 270,
      target: { x: 1010, y: 300 },
      angle: 90,
    },
    {
      position: { x: 500, y: 40 },
      initial: 180,
      target: { x: 500, y: -10 },
      angle: 0,
    },
    {
      position: { x: 500, y: 660 },
      initial: 0,
      target: { x: 500, y: 710 },
      angle: 180,
    },
  ]) {
    for (const [field, value] of [
      ["position", edge.position],
      ["rotation", edge.initial],
    ]) {
      const response = await page.request.post(request.url(), {
        headers,
        data: {
          type: "piece.set",
          slideId: command.slideId,
          assignmentId: command.id,
          field,
          value,
        },
      });
      expect(response.ok()).toBeTruthy();
    }
    await expect(page.getByLabel("Facing angle")).toHaveValue(
      String(edge.initial),
    );
    await page.locator(".rotation-handle circle").scrollIntoViewIfNeeded();
    const handle = await page.locator(".rotation-handle circle").boundingBox();
    const target = await page.locator(".board").evaluate((svg, point) => {
      const p = new DOMPoint(point.x, point.y).matrixTransform(
        (svg as SVGSVGElement).getScreenCTM()!,
      );
      return { x: p.x, y: p.y };
    }, edge.target);
    await page.mouse.move(
      handle!.x + handle!.width / 2,
      handle!.y + handle!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () =>
        Math.abs(
          ((Number(await page.getByLabel("Facing angle").inputValue()) -
            edge.angle +
            540) %
            360) -
            180,
        ),
      )
      .toBeLessThan(0.5);
    await expect(
      page.locator(`[data-testid="piece-${command.id}"]`),
    ).toHaveAttribute(
      "transform",
      `translate(${edge.position.x} ${edge.position.y})`,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});
