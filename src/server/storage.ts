import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { type Session } from "../shared/domain";
import { slideMarkdown } from "../shared/markdown";
import { boardSvg } from "../shared/scene";
import { validateSession } from "./validation";

export type PreviewState = {
  status: "pending" | "ready" | "failed";
  revision: number;
  error?: string;
};
export interface StorageOptions {
  beforePublish?: (file: string) => Promise<void>;
  render?: (svg: string) => Promise<Buffer>;
  debounce?: number;
}
const safeId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    throw new Error("Invalid session identifier.");
  return id;
};
const require = createRequire(import.meta.url);
const fontFile =
  require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff");
// Pango receives a bundled font file explicitly rather than depending on host fonts.
export async function renderBoard(svg: string) {
  const { default: sharp } = await import("sharp");
  const labels = [
    ...svg.matchAll(
      /<text text-anchor="middle" x="(-?[0-9.]+)" y="(-?[0-9.]+)">(.*?)<\/text>/g,
    ),
  ];
  for (const match of labels) {
    const { data, info } = await sharp({
      text: {
        text: match[3],
        font: "Inter 16",
        fontfile: fontFile,
        rgba: true,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    svg = svg.replace(
      match[0],
      `<image x="${Number(match[1]) - info.width / 2}" y="${Number(match[2]) - 14}" width="${info.width}" height="${info.height}" href="data:image/png;base64,${data.toString("base64")}"/>`,
    );
  }
  return sharp(Buffer.from(svg)).png().toBuffer();
}
export class SessionStorage {
  readonly previews = new Map<string, PreviewState>();
  onPreview: (id: string, state: PreviewState) => void = () => {};
  private queues = new Map<string, Promise<unknown>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private cache = new Map<string, Session>();
  constructor(
    readonly root: string,
    private options: StorageOptions = {},
  ) {}
  private folder(id: string) {
    return path.join(this.root, safeId(id));
  }
  async exclusive<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(operation);
    this.queues.set(id, next);
    try {
      return await next;
    } finally {
      if (this.queues.get(id) === next) this.queues.delete(id);
    }
  }
  async read(id: string): Promise<Session> {
    return this.exclusive(id, () => this.load(id));
  }
  private async load(id: string): Promise<Session> {
    let session = this.cache.get(id);
    if (!session) {
      session = validateSession(
        JSON.parse(
          await readFile(path.join(this.folder(id), "session.json"), "utf8"),
        ),
      );
      if (session.id !== id)
        throw new Error("Session folder and source identifiers disagree.");
      this.cache.set(id, session);
      this.schedule(session);
    }
    return structuredClone(session);
  }
  async list() {
    await mkdir(this.root, { recursive: true });
    const dirs = await readdir(this.root, { withFileTypes: true });
    const result: { id: string; name: string; revision: number }[] = [];
    for (const dir of dirs) {
      if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
      const session = await this.read(dir.name);
      result.push({
        id: session.id,
        name: session.name,
        revision: session.revision,
      });
    }
    return result;
  }
  async create(session: Session) {
    validateSession(session);
    return this.exclusive(session.id, async () => {
      await mkdir(this.root, { recursive: true });
      const target = this.folder(session.id);
      try {
        await access(target);
        throw new Error("Session already exists.");
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ))
          throw error;
      }
      const staging = path.join(this.root, `.creating-${crypto.randomUUID()}`);
      await mkdir(staging);
      try {
        await this.atomic(
          path.join(staging, "session.json"),
          JSON.stringify(session, null, 2),
        );
        await rename(staging, target);
        await this.syncDirectory(this.root);
      } finally {
        await rm(staging, { recursive: true, force: true }).catch(() => {});
      }
      this.cache.set(session.id, structuredClone(session));
      this.schedule(session);
      return structuredClone(session);
    });
  }
  async update(id: string, mutate: (session: Session) => void | Promise<void>) {
    return this.exclusive(id, async () => {
      const session = await this.load(id);
      await mutate(session);
      session.revision++;
      validateSession(session);
      await this.publish(session);
      return structuredClone(session);
    });
  }
  private async atomic(file: string, bytes: string | Buffer) {
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    const handle = await open(temporary, "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await this.options.beforePublish?.(file);
      await rename(temporary, file);
      await this.syncDirectory(path.dirname(file));
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
  }
  private async syncDirectory(folder: string) {
    // Windows does not expose directory fsync through Node filesystem handles.
    if (process.platform === "win32") return;
    const directory = await open(folder, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
  private async publish(session: Session) {
    try {
      await this.atomic(
        path.join(this.folder(session.id), "session.json"),
        JSON.stringify(session, null, 2),
      );
    } catch (error) {
      // If publication completed but directory synchronization failed, the next
      // operation must read the actual source rather than overwrite it from cache.
      this.cache.delete(session.id);
      throw error;
    }
    this.cache.set(session.id, structuredClone(session));
    this.schedule(session);
  }
  private setPreview(id: string, state: PreviewState) {
    this.previews.set(id, state);
    this.onPreview(id, state);
  }
  private schedule(session: Session) {
    clearTimeout(this.timers.get(session.id));
    this.setPreview(session.id, {
      status: "pending",
      revision: session.revision,
    });
    this.timers.set(
      session.id,
      setTimeout(() => {
        this.timers.delete(session.id);
        void this.generate(session.id);
      }, this.options.debounce ?? 600),
    );
  }
  async generate(id: string) {
    return this.exclusive(id, async () => {
      try {
        const session = await this.load(id);
        for (const slide of session.slides) {
          const folder = path.join(this.folder(id), "slides", slide.id);
          await mkdir(folder, { recursive: true });
          const markdown = slideMarkdown(session, slide);
          const png = await (this.options.render ?? renderBoard)(
            boardSvg(session, slide),
          );
          await this.atomic(path.join(folder, "transcript.md"), markdown);
          await this.atomic(path.join(folder, "board.png"), png);
          await this.atomic(
            path.join(folder, "slide.json"),
            JSON.stringify({ revision: session.revision, slide }, null, 2),
          );
        }
        const slidesFolder = path.join(this.folder(id), "slides");
        await mkdir(slidesFolder, { recursive: true });
        for (const dir of await readdir(slidesFolder)) {
          if (!session.slides.some((s) => s.id === dir))
            await rm(path.join(slidesFolder, safeId(dir)), {
              recursive: true,
              force: true,
            });
        }
        // The manifest commits derived outputs as a complete revision; readers can
        // detect an interrupted generation without mistaking it for source data.
        await this.atomic(
          path.join(this.folder(id), "previews.json"),
          JSON.stringify({
            revision: session.revision,
            slides: session.slides.map((s) => s.id),
          }),
        );
        this.setPreview(id, { status: "ready", revision: session.revision });
      } catch (error) {
        this.setPreview(id, {
          status: "failed",
          revision: this.cache.get(id)?.revision ?? 0,
          error: String(error),
        });
      }
    });
  }
  async restore(value: unknown) {
    const session = validateSession(value);
    session.id = crypto.randomUUID();
    session.name = `${session.name.slice(0, 180)} (restored)`;
    session.revision = 0;
    return this.create(session);
  }
  async delete(id: string) {
    return this.exclusive(id, async () => {
      await this.load(id);
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
      const tombstone = path.join(this.root, `.deleted-${crypto.randomUUID()}`);
      await rename(this.folder(id), tombstone);
      this.cache.delete(id);
      this.previews.delete(id);
      await rm(tombstone, { recursive: true, force: true });
    });
  }
  async close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled(this.queues.values());
  }
}
