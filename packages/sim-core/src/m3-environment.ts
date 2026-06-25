import type { NamedRandomStreams } from "./deterministic-rng";
import {
  M3_DEFAULT_DAWN_HOUR,
  M3_ENVIRONMENT_OWNER_VERSION,
  M3_HOURS_PER_DAY,
  M3_TICKS_PER_HOUR,
  M3_WEATHER_INTERVAL_TICKS,
  M3_WEATHER_STREAM_ID,
  chooseScheduledWeather,
  createDefaultM3ScheduleWindows,
  getDefaultWindowDefinition,
  getWeatherSeverity,
  integerDivide,
  resolveOutdoorWorkReason,
  type M3DayNightProjection,
  type M3EnvironmentCheckpoint,
  type M3EnvironmentCommand,
  type M3EnvironmentDirtyKey,
  type M3EnvironmentMetrics,
  type M3EnvironmentProjection,
  type M3EnvironmentReason,
  type M3EnvironmentReplayResult,
  type M3ScheduleWindowDefinition,
  type M3ScheduleWindowId,
  type M3WeatherKind,
  type M3WeatherProjection,
} from "./m3-environment-data";
import { TICKS_PER_DAY, requireSafeTick, type Tick } from "./time";

export class DayNightStore {
  readonly dawnHour: number;
  readonly windows: readonly M3ScheduleWindowDefinition[];

  private scheduleWindowVersion = 1;
  private currentWindow: M3ScheduleWindowId = "dawn";
  private lastReason: M3EnvironmentReason = "daynight.initialized";
  private nextWindowBoundaryTick: Tick;
  private updateCount = 0;
  private transitionCount = 0;

  constructor(
    windows: readonly M3ScheduleWindowDefinition[] = createDefaultM3ScheduleWindows(),
    dawnHour = M3_DEFAULT_DAWN_HOUR,
  ) {
    this.windows = windows;
    this.dawnHour = dawnHour;
    this.nextWindowBoundaryTick = this.findNextWindowBoundaryAfter(0);
  }

  advanceToTick(tick: Tick, dirtyQueue: M3EnvironmentDirtyQueue): M3DayNightProjection {
    const safeTick = requireSafeTick(tick, "environment tick");
    this.updateCount += 1;
    let transitionAtSafeTick = false;

    while (this.nextWindowBoundaryTick <= safeTick) {
      const boundaryTick = this.nextWindowBoundaryTick;
      this.applyWindowBoundary(boundaryTick, dirtyQueue);
      transitionAtSafeTick = boundaryTick === safeTick;
      this.nextWindowBoundaryTick = this.findNextWindowBoundaryAfter(boundaryTick);
    }

    this.lastReason = transitionAtSafeTick
      ? "daynight.window_changed"
      : "daynight.window_unchanged";
    return this.createProjection(safeTick);
  }

  createProjection(tick: Tick): M3DayNightProjection {
    const safeTick = requireSafeTick(tick, "environment tick");
    const tickOfDay = safeTick % TICKS_PER_DAY;
    const hourFromDawn = integerDivide(tickOfDay, M3_TICKS_PER_HOUR);
    const day = integerDivide(safeTick, TICKS_PER_DAY);
    const hour = (hourFromDawn + this.dawnHour) % M3_HOURS_PER_DAY;

    return Object.freeze({
      ownerVersion: M3_ENVIRONMENT_OWNER_VERSION,
      tick: safeTick,
      day,
      hour,
      tickOfDay,
      scheduleWindow: this.resolveWindow(safeTick).id,
      scheduleWindowVersion: this.scheduleWindowVersion,
      reason: this.lastReason,
    });
  }

  createMetrics(): Pick<M3EnvironmentMetrics, "dayNightUpdates" | "dayNightWindowTransitions"> {
    return {
      dayNightUpdates: this.updateCount,
      dayNightWindowTransitions: this.transitionCount,
    };
  }

  private resolveWindow(tick: Tick): M3ScheduleWindowDefinition {
    const tickOfDay = tick % TICKS_PER_DAY;

    for (const window of this.windows) {
      if (tickOfDay >= window.startTickOfDay && tickOfDay < window.endTickOfDay) {
        return window;
      }
    }

    return getDefaultWindowDefinition("dawn");
  }

  private applyWindowBoundary(tick: Tick, dirtyQueue: M3EnvironmentDirtyQueue): void {
    const window = this.resolveWindow(tick);

    if (window.id === this.currentWindow) {
      return;
    }

    this.currentWindow = window.id;
    this.scheduleWindowVersion += 1;
    this.transitionCount += 1;
    dirtyQueue.enqueueScheduleChange();
  }

  private findNextWindowBoundaryAfter(tick: Tick): Tick {
    const tickOfDay = tick % TICKS_PER_DAY;
    const dayStartTick = tick - tickOfDay;
    let nextBoundary = dayStartTick + TICKS_PER_DAY;

    for (const window of this.windows) {
      const boundaryTick = dayStartTick + window.startTickOfDay;
      if (boundaryTick > tick && boundaryTick < nextBoundary) {
        nextBoundary = boundaryTick;
      }
    }

    return nextBoundary;
  }
}

export class WeatherStore {
  private currentWeather: M3WeatherKind = "dry_cool";
  private previousWeather: M3WeatherKind = "dry_cool";
  private transitionTick: Tick = 0;
  private commandForcedWeather: M3WeatherKind | null = null;
  private weatherVersion = 1;
  private weatherSourceVersion = 0;
  private nextScheduledTick: Tick = M3_WEATHER_INTERVAL_TICKS;
  private lastReason: M3EnvironmentReason = "weather.initialized";
  private scheduledUpdates = 0;
  private commandTransitions = 0;

  advanceToTick(
    tick: Tick,
    streams: NamedRandomStreams,
    dirtyQueue: M3EnvironmentDirtyQueue,
  ): M3WeatherProjection {
    const safeTick = requireSafeTick(tick, "environment tick");
    let lastScheduledTick: Tick | null = null;

    while (this.commandForcedWeather === null && this.nextScheduledTick <= safeTick) {
      const scheduledTick = this.nextScheduledTick;
      const nextWeather = chooseScheduledWeather(
        this.currentWeather,
        streams.nextInt(M3_WEATHER_STREAM_ID, 1_000),
      );
      this.weatherSourceVersion += 1;
      this.scheduledUpdates += 1;
      this.nextScheduledTick += M3_WEATHER_INTERVAL_TICKS;
      this.applyWeather(scheduledTick, nextWeather, "weather.changed_by_stream", dirtyQueue);
      lastScheduledTick = scheduledTick;
    }

    if (lastScheduledTick !== safeTick) {
      this.lastReason = "weather.unchanged";
    }

    return this.createProjection(safeTick);
  }

  forceWeather(
    tick: Tick,
    weather: M3WeatherKind,
    dirtyQueue: M3EnvironmentDirtyQueue,
  ): M3WeatherProjection {
    const safeTick = requireSafeTick(tick, "environment tick");
    this.commandForcedWeather = weather;
    this.commandTransitions += 1;
    this.applyWeather(safeTick, weather, "weather.changed_by_command", dirtyQueue);
    return this.createProjection(safeTick);
  }

  createProjection(tick: Tick): M3WeatherProjection {
    return Object.freeze({
      ownerVersion: M3_ENVIRONMENT_OWNER_VERSION,
      tick: requireSafeTick(tick, "environment tick"),
      currentWeather: this.currentWeather,
      previousWeather: this.previousWeather,
      transitionTick: this.transitionTick,
      commandForcedWeather: this.commandForcedWeather,
      severity: getWeatherSeverity(this.currentWeather),
      weatherSourceStreamId: M3_WEATHER_STREAM_ID,
      weatherSourceVersion: this.weatherSourceVersion,
      weatherVersion: this.weatherVersion,
      reason: this.lastReason,
    });
  }

  createMetrics(): Pick<
    M3EnvironmentMetrics,
    "weatherScheduledUpdates" | "weatherCommandTransitions" | "weatherStreamDraws"
  > {
    return {
      weatherScheduledUpdates: this.scheduledUpdates,
      weatherCommandTransitions: this.commandTransitions,
      weatherStreamDraws: this.weatherSourceVersion,
    };
  }

  private applyWeather(
    tick: Tick,
    weather: M3WeatherKind,
    reason: M3EnvironmentReason,
    dirtyQueue: M3EnvironmentDirtyQueue,
  ): void {
    if (weather !== this.currentWeather) {
      this.previousWeather = this.currentWeather;
      this.currentWeather = weather;
      this.transitionTick = tick;
      this.weatherVersion += 1;
      dirtyQueue.enqueueWeatherChange();
    }

    this.lastReason = reason;
  }
}

export class M3EnvironmentDirtyQueue {
  private readonly queued: M3EnvironmentDirtyKey[] = [];
  private dirtyPeak = 0;

  enqueueScheduleChange(): void {
    this.enqueue("schedule.work");
    this.enqueue("schedule.rest");
    this.enqueue("need.rate");
    this.enqueue("mood.context");
    this.enqueue("read-model.environment");
  }

  enqueueWeatherChange(): void {
    this.enqueue("weather.exposure");
    this.enqueue("need.rate");
    this.enqueue("mood.context");
    this.enqueue("schedule.work");
    this.enqueue("schedule.rest");
    this.enqueue("read-model.environment");
  }

  drain(maxCount: number, output: M3EnvironmentDirtyKey[]): number {
    if (!Number.isSafeInteger(maxCount) || maxCount < 0) {
      throw new Error("environment dirty drain budget must be a non-negative safe integer");
    }

    let drained = 0;
    while (drained < maxCount && this.queued.length > 0) {
      const key = this.queued.shift();
      if (key !== undefined) {
        output.push(key);
        drained += 1;
      }
    }

    return drained;
  }

  createMetrics(): Pick<M3EnvironmentMetrics, "dirtyBacklog" | "dirtyBacklogPeak"> {
    return { dirtyBacklog: this.queued.length, dirtyBacklogPeak: this.dirtyPeak };
  }

  private enqueue(key: M3EnvironmentDirtyKey): void {
    for (const queuedKey of this.queued) {
      if (queuedKey === key) {
        return;
      }
    }

    this.queued.push(key);
    if (this.queued.length > this.dirtyPeak) {
      this.dirtyPeak = this.queued.length;
    }
  }
}

export class M3EnvironmentStore {
  readonly dayNight = new DayNightStore();
  readonly weather = new WeatherStore();
  readonly dirtyQueue = new M3EnvironmentDirtyQueue();

  private projectionBuilds = 0;

  advanceToTick(tick: Tick, streams: NamedRandomStreams): M3EnvironmentProjection {
    this.dayNight.advanceToTick(tick, this.dirtyQueue);
    this.weather.advanceToTick(tick, streams, this.dirtyQueue);
    return this.createProjection(tick);
  }

  forceWeather(tick: Tick, weather: M3WeatherKind): M3WeatherProjection {
    return this.weather.forceWeather(tick, weather, this.dirtyQueue);
  }

  createProjection(tick: Tick): M3EnvironmentProjection {
    const dayNight = this.dayNight.createProjection(tick);
    const weather = this.weather.createProjection(tick);
    const window = getDefaultWindowDefinition(dayNight.scheduleWindow);
    const outdoorWorkReason = resolveOutdoorWorkReason(window, weather);
    this.projectionBuilds += 1;

    return Object.freeze({
      ownerVersion: M3_ENVIRONMENT_OWNER_VERSION,
      tick: requireSafeTick(tick, "environment tick"),
      version: dayNight.scheduleWindowVersion + weather.weatherVersion,
      dayNight,
      weather,
      outdoorWorkAllowed: outdoorWorkReason === "environment.outdoor_allowed",
      outdoorWorkReason,
      needRateModifierMilli:
        window.needRateModifierMilli + weather.severity.outdoorExposurePenaltyMilli,
      moodContextCode: window.moodContextCode + weather.severity.precipitation,
    });
  }

  createMetrics(): M3EnvironmentMetrics {
    return {
      ...this.dayNight.createMetrics(),
      ...this.weather.createMetrics(),
      projectionBuilds: this.projectionBuilds,
      ...this.dirtyQueue.createMetrics(),
    };
  }
}

export function createM3EnvironmentStore(): M3EnvironmentStore {
  return new M3EnvironmentStore();
}

export function runM3EnvironmentReplay(options: {
  readonly ticks: Tick;
  readonly streams: NamedRandomStreams;
  readonly commands: readonly M3EnvironmentCommand[];
  readonly checkpoints: readonly Tick[];
}): M3EnvironmentReplayResult {
  const store = createM3EnvironmentStore();
  const checkpoints: M3EnvironmentCheckpoint[] = [];
  let commandIndex = 0;
  let previousCommandTick = -1;

  for (const command of options.commands) {
    if (command.tick < previousCommandTick) {
      return {
        ok: false,
        reason: "environment.command_stream_not_sorted",
        checkpoints,
        metrics: store.createMetrics(),
      };
    }
    previousCommandTick = command.tick;
  }

  for (const checkpointTick of options.checkpoints) {
    while (commandIndex < options.commands.length) {
      const command = options.commands[commandIndex];
      if (command === undefined || command.tick > checkpointTick) {
        break;
      }
      store.dayNight.advanceToTick(command.tick, store.dirtyQueue);
      store.forceWeather(command.tick, command.weather);
      commandIndex += 1;
    }

    const projection = store.advanceToTick(checkpointTick, options.streams);
    checkpoints.push({
      tick: checkpointTick,
      projection,
      dirtyBacklog: store.createMetrics().dirtyBacklog,
    });
  }

  store.advanceToTick(options.ticks, options.streams);

  return {
    ok: true,
    reason: "environment.outdoor_allowed",
    checkpoints,
    metrics: store.createMetrics(),
  };
}
