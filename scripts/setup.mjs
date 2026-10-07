import { copyFile, constants } from "node:fs/promises";
try {
  await copyFile(".env.example", ".env", constants.COPYFILE_EXCL);
  console.log("Created .env with URL-only joining and local session storage.");
} catch (error) {
  if (error.code === "EEXIST") console.log("Existing .env kept.");
  else throw error;
}
