import { SessionStorage } from "../../src/server/storage";
const storage = new SessionStorage(process.argv[2], {
  debounce: 60000,
  beforePublish: async () => {
    process.stdout.write("READY_TO_PUBLISH\n");
    process.stdin.resume();
    await new Promise(() => {});
  },
});
await storage.update(process.argv[3], (s) => {
  s.name = "Interrupted revision";
});
process.stdout.write("PUBLISHED\n");
