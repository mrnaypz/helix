"use server";

import { revalidatePath } from "next/cache";
import { getEngine } from "@/lib/bot/runtime";
import type { LevelKind } from "@/lib/bot/types";

function refresh() {
  revalidatePath("/");
  revalidatePath("/levels");
  revalidatePath("/strategy");
}

export async function startEngine() {
  const engine = await getEngine();
  await engine.start();
  refresh();
}

export async function pauseEngine() {
  const engine = await getEngine();
  await engine.pause();
  refresh();
}

export async function stopEngine() {
  const engine = await getEngine();
  await engine.stop();
  refresh();
}

export async function killEngine() {
  const engine = await getEngine();
  await engine.kill();
  refresh();
}

export async function resetPaper() {
  const engine = await getEngine();
  await engine.resetPaper();
  refresh();
}

export async function addLevel(formData: FormData) {
  const engine = await getEngine();
  await engine.addLevel({
    coin: String(formData.get("coin") ?? ""),
    kind: String(formData.get("kind") ?? "resistance") as LevelKind,
    price: Number(formData.get("price")),
    note: String(formData.get("note") ?? ""),
  });
  refresh();
}

export async function removeLevel(formData: FormData) {
  const engine = await getEngine();
  await engine.removeLevel(String(formData.get("id") ?? ""));
  refresh();
}

export async function clearLevels() {
  const engine = await getEngine();
  await engine.clearLevels();
  refresh();
}
