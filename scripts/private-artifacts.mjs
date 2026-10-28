import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

function localFile(directory, name) {
  const root = resolve(directory);
  const file = resolve(root, name);
  if (dirname(file) !== root || !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("Invalid private artifact filename.");
  return file;
}

/** A killed worker leaves an ignored temporary file, never a half-written artifact. */
export async function writePrivateJson(directory, name, value) {
  const target = localFile(directory, name);
  const temporary = localFile(directory, name + ".partial-" + randomUUID());
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
  await rename(temporary, target);
}

/** Retain interrupted older writes for diagnosis while allowing refill to recover. */
export async function readPrivateJson(directory, name) {
  const target = localFile(directory, name);
  const text = await readFile(target, "utf8");
  try { return JSON.parse(text); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const retained = name + ".invalid-" + randomUUID();
    await rename(target, localFile(directory, retained));
    console.warn("Retained interrupted private artifact as " + retained + "; continuing refill.");
    return undefined;
  }
}
