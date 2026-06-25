import type { Tick } from "./time";
import { TICKS_PER_DAY } from "./time";

export const M3_ENVIRONMENT_OWNER_VERSION = 1;
export const M3_WEATHER_STREAM_ID = "weather:m3-ordinary-life";
export const M3_HOURS_PER_DAY = 24;
export const M3_TICKS_PER_HOUR = TICKS_PER_DAY / M3_HOURS_PER_DAY;
export const M3_DEFAULT_DAWN_HOUR = 6;
export const M3_WEATHER_INTERVAL_TICKS = 3_000;

export type M3ScheduleWindowId = "dawn" | "daytime" | "evening" | "night";
export type M3WeatherKind = "dry_cool" | "overcast" | "rain_light" | "rain_heavy" | "fog_cool";
export type M3EnvironmentDirtyKey =
  | "schedule.work"
  | "schedule.rest"
  | "need.rate"
  | "mood.context"
  | "weather.exposure"
  | "read-model.environment";
export type M3EnvironmentReason =
  | "daynight.initialized"
  | "daynight.window_unchanged"
  | "daynight.window_changed"
  | "weather.initialized"
  | "weather.unchanged"
  | "weather.changed_by_command"
  | "weather.changed_by_stream"
  | "environment.outdoor_allowed"
  | "work.rejected_outdoor_night_window"
  | "work.rejected_weather_exposure"
  | "environment.command_stream_not_sorted";

export interface M3ScheduleWindowDefinition {
  readonly id: M3ScheduleWindowId;
  readonly startTickOfDay: number;
  readonly endTickOfDay: number;
  readonly outdoorWorkAllowed: boolean;
  readonly needRateModifierMilli: number;
  readonly moodContextCode: number;
}

export interface M3WeatherSeverityLanes {
  readonly precipitation: number;
  readonly wind: number;
  readonly visibility: number;
  readonly cold: number;
  readonly outdoorExposurePenaltyMilli: number;
}

export interface M3DayNightProjection {
  readonly ownerVersion: typeof M3_ENVIRONMENT_OWNER_VERSION;
  readonly tick: Tick;
  readonly day: number;
  readonly hour: number;
  readonly tickOfDay: number;
  readonly scheduleWindow: M3ScheduleWindowId;
  readonly scheduleWindowVersion: number;
  readonly reason: M3EnvironmentReason;
}

export interface M3WeatherProjection {
  readonly ownerVersion: typeof M3_ENVIRONMENT_OWNER_VERSION;
  readonly tick: Tick;
  readonly currentWeather: M3WeatherKind;
  readonly previousWeather: M3WeatherKind;
  readonly transitionTick: Tick;
  readonly commandForcedWeather: M3WeatherKind | null;
  readonly severity: M3WeatherSeverityLanes;
  readonly weatherSourceStreamId: typeof M3_WEATHER_STREAM_ID;
  readonly weatherSourceVersion: number;
  readonly weatherVersion: number;
  readonly reason: M3EnvironmentReason;
}

export interface M3EnvironmentProjection {
  readonly ownerVersion: typeof M3_ENVIRONMENT_OWNER_VERSION;
  readonly tick: Tick;
  readonly version: number;
  readonly dayNight: M3DayNightProjection;
  readonly weather: M3WeatherProjection;
  readonly outdoorWorkAllowed: boolean;
  readonly outdoorWorkReason: M3EnvironmentReason;
  readonly needRateModifierMilli: number;
  readonly moodContextCode: number;
}

export interface M3EnvironmentMetrics {
  readonly dayNightUpdates: number;
  readonly dayNightWindowTransitions: number;
  readonly weatherScheduledUpdates: number;
  readonly weatherCommandTransitions: number;
  readonly weatherStreamDraws: number;
  readonly projectionBuilds: number;
  readonly dirtyBacklog: number;
  readonly dirtyBacklogPeak: number;
}

export interface M3EnvironmentCommand {
  readonly tick: Tick;
  readonly kind: "weather.force";
  readonly weather: M3WeatherKind;
}

export interface M3EnvironmentCheckpoint {
  readonly tick: Tick;
  readonly projection: M3EnvironmentProjection;
  readonly dirtyBacklog: number;
}

export interface M3EnvironmentReplayResult {
  readonly ok: boolean;
  readonly reason: M3EnvironmentReason;
  readonly checkpoints: readonly M3EnvironmentCheckpoint[];
  readonly metrics: M3EnvironmentMetrics;
}

const DAWN_WINDOW = freezeWindow("dawn", 0, 3_000, true, 1_000, 10);
const DAYTIME_WINDOW = freezeWindow("daytime", 3_000, 16_500, true, 1_000, 20);
const EVENING_WINDOW = freezeWindow("evening", 16_500, 19_500, true, 1_050, 30);
const NIGHT_WINDOW = freezeWindow("night", 19_500, TICKS_PER_DAY, false, 1_150, 40);

const DRY_COOL_SEVERITY = freezeSeverity(0, 120, 900, 420, 0);
const OVERCAST_SEVERITY = freezeSeverity(120, 180, 760, 500, 60);
const RAIN_LIGHT_SEVERITY = freezeSeverity(360, 260, 720, 520, 150);
const RAIN_HEAVY_SEVERITY = freezeSeverity(760, 520, 420, 620, 360);
const FOG_COOL_SEVERITY = freezeSeverity(80, 120, 360, 560, 120);

export const DEFAULT_M3_SCHEDULE_WINDOWS: readonly M3ScheduleWindowDefinition[] = Object.freeze([
  DAWN_WINDOW,
  DAYTIME_WINDOW,
  EVENING_WINDOW,
  NIGHT_WINDOW,
]);

export function createDefaultM3ScheduleWindows(): readonly M3ScheduleWindowDefinition[] {
  return DEFAULT_M3_SCHEDULE_WINDOWS;
}

export function getDefaultWindowDefinition(id: M3ScheduleWindowId): M3ScheduleWindowDefinition {
  if (id === "daytime") {
    return DAYTIME_WINDOW;
  }
  if (id === "evening") {
    return EVENING_WINDOW;
  }
  if (id === "night") {
    return NIGHT_WINDOW;
  }
  return DAWN_WINDOW;
}

export function chooseScheduledWeather(current: M3WeatherKind, roll: number): M3WeatherKind {
  if (current === "rain_heavy") {
    return roll < 600 ? "rain_light" : "overcast";
  }
  if (roll < 420) {
    return "dry_cool";
  }
  if (roll < 680) {
    return "overcast";
  }
  if (roll < 860) {
    return "rain_light";
  }
  if (roll < 940) {
    return "fog_cool";
  }
  return "rain_heavy";
}

export function getWeatherSeverity(weather: M3WeatherKind): M3WeatherSeverityLanes {
  if (weather === "rain_light") {
    return RAIN_LIGHT_SEVERITY;
  }
  if (weather === "rain_heavy") {
    return RAIN_HEAVY_SEVERITY;
  }
  if (weather === "fog_cool") {
    return FOG_COOL_SEVERITY;
  }
  if (weather === "overcast") {
    return OVERCAST_SEVERITY;
  }
  return DRY_COOL_SEVERITY;
}

export function resolveOutdoorWorkReason(
  window: M3ScheduleWindowDefinition,
  weather: M3WeatherProjection,
): M3EnvironmentReason {
  if (!window.outdoorWorkAllowed) {
    return "work.rejected_outdoor_night_window";
  }
  if (weather.currentWeather === "rain_heavy") {
    return "work.rejected_weather_exposure";
  }
  return "environment.outdoor_allowed";
}

export function integerDivide(value: number, divisor: number): number {
  return (value - (value % divisor)) / divisor;
}

function freezeWindow(
  id: M3ScheduleWindowId,
  startTickOfDay: number,
  endTickOfDay: number,
  outdoorWorkAllowed: boolean,
  needRateModifierMilli: number,
  moodContextCode: number,
): M3ScheduleWindowDefinition {
  return Object.freeze({
    id,
    startTickOfDay,
    endTickOfDay,
    outdoorWorkAllowed,
    needRateModifierMilli,
    moodContextCode,
  });
}

function freezeSeverity(
  precipitation: number,
  wind: number,
  visibility: number,
  cold: number,
  outdoorExposurePenaltyMilli: number,
): M3WeatherSeverityLanes {
  return Object.freeze({ precipitation, wind, visibility, cold, outdoorExposurePenaltyMilli });
}
