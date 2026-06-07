import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DailyLog, FoodLogEntry, Settings, UserProfile, WeeklySummary } from "../types.js";

export class NutritionStorage {
  readonly homeDir: string;
  readonly logsDir: string;
  readonly weeklyDir: string;
  readonly nutritionCacheDir: string;
  readonly profilePath: string;
  readonly settingsPath: string;

  constructor(homeDir = process.env.NUTRITION_MCP_HOME) {
    this.homeDir = expandHome(homeDir?.trim() || "~/.nutrition-mcp");
    this.logsDir = path.join(this.homeDir, "logs");
    this.weeklyDir = path.join(this.homeDir, "weekly");
    this.nutritionCacheDir = path.join(this.homeDir, "cache", "nutrition");
    this.profilePath = path.join(this.homeDir, "profile.json");
    this.settingsPath = path.join(this.homeDir, "settings.json");
  }

  async ensureInitialized(): Promise<void> {
    await fs.mkdir(this.logsDir, { recursive: true });
    await fs.mkdir(this.weeklyDir, { recursive: true });
    await fs.mkdir(this.nutritionCacheDir, { recursive: true });

    if (!(await exists(this.settingsPath))) {
      const now = new Date().toISOString();
      const settings: Settings = {
        createdAt: now,
        updatedAt: now,
        storageVersion: 1
      };
      await writeJson(this.settingsPath, settings);
    }
  }

  async readProfile(): Promise<UserProfile | null> {
    await this.ensureInitialized();
    return readJsonIfExists<UserProfile>(this.profilePath);
  }

  async writeProfile(profile: UserProfile): Promise<UserProfile> {
    await this.ensureInitialized();
    await writeJson(this.profilePath, profile);
    return profile;
  }

  async readDailyLog(date: string): Promise<DailyLog> {
    await this.ensureInitialized();
    const file = this.dailyLogPath(date);
    const existing = await readJsonIfExists<DailyLog>(file);
    if (existing) {
      return normalizeDailyLog(existing, date);
    }
    return emptyDailyLog(date);
  }

  async writeDailyLog(log: DailyLog): Promise<DailyLog> {
    await this.ensureInitialized();
    const normalized = normalizeDailyLog(log, log.date);
    normalized.updatedAt = new Date().toISOString();
    await writeJson(this.dailyLogPath(log.date), normalized);
    return normalized;
  }

  async appendFoodLog(date: string, entry: FoodLogEntry): Promise<DailyLog> {
    const log = await this.readDailyLog(date);
    log.entries.push(entry);
    return this.writeDailyLog(log);
  }

  async listDailyLogDates(): Promise<string[]> {
    await this.ensureInitialized();
    const files = await fs.readdir(this.logsDir);
    return files
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => file.slice(0, -5))
      .sort();
  }

  async readLogsBetween(startDate?: string, endDate?: string): Promise<DailyLog[]> {
    const dates = await this.listDailyLogDates();
    const filtered = dates.filter((date) => {
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    });
    return Promise.all(filtered.map((date) => this.readDailyLog(date)));
  }

  async undoLastLog(date?: string): Promise<FoodLogEntry | null> {
    const dates = date ? [date] : (await this.listDailyLogDates()).reverse();
    for (const candidateDate of dates) {
      const log = await this.readDailyLog(candidateDate);
      if (log.entries.length === 0) {
        continue;
      }
      const removed = log.entries.pop() ?? null;
      await this.writeDailyLog(log);
      return removed;
    }
    return null;
  }

  async writeWeeklySummary(summary: WeeklySummary): Promise<WeeklySummary> {
    await this.ensureInitialized();
    await writeJson(path.join(this.weeklyDir, `${summary.week}.json`), summary);
    return summary;
  }

  dailyLogPath(date: string): string {
    return path.join(this.logsDir, `${date}.json`);
  }
}

export function currentDateInTimezone(timezone: string): string {
  return dateKeyFor(new Date(), timezone);
}

export function dateKeyFor(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function isoWeekKey(dateKey: string): string {
  const date = parseDateKeyAsUtc(dateKey);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekBounds(dateKey: string): { startDate: string; endDate: string; week: string } {
  const date = parseDateKeyAsUtc(dateKey);
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    startDate: toDateKey(monday),
    endDate: toDateKey(sunday),
    week: isoWeekKey(dateKey)
  };
}

export function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = parseDateKeyAsUtc(startDate);
  const end = parseDateKeyAsUtc(endDate);
  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function normalizeDailyLog(log: DailyLog, date: string): DailyLog {
  const totals = log.entries.reduce(
    (sum, entry) => ({
      calories: sum.calories + entry.calories,
      protein: sum.protein + entry.protein
    }),
    { calories: 0, protein: 0 }
  );
  return {
    date,
    entries: log.entries,
    totals: {
      calories: Math.round(totals.calories),
      protein: roundProtein(totals.protein)
    },
    updatedAt: log.updatedAt || new Date().toISOString()
  };
}

function emptyDailyLog(date: string): DailyLog {
  return {
    date,
    entries: [],
    totals: {
      calories: 0,
      protein: 0
    },
    updatedAt: new Date().toISOString()
  };
}

function parseDateKeyAsUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function roundProtein(value: number): number {
  return Math.round(value * 10) / 10;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!(await exists(filePath))) {
    return null;
  }
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function expandHome(value: string): string {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}
