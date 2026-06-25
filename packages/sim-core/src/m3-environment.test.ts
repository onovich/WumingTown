import { describe, expect, it } from "vitest";

import {
  DayNightStore,
  M3EnvironmentDirtyQueue,
  M3_WEATHER_STREAM_ID,
  TICKS_PER_DAY,
  WeatherStore,
  createM3EnvironmentStore,
  createNamedRandomStreams,
  runM3EnvironmentReplay,
  type M3EnvironmentCommand,
  type M3EnvironmentDirtyKey,
} from "./index";

describe("M3 day/night and weather owner state", () => {
  it("derives day, hour and schedule window only from authoritative ticks", () => {
    const store = createM3EnvironmentStore();
    const streams = createNamedRandomStreams({ seed: "m3-time" });

    const dawn = store.advanceToTick(0, streams);
    const daytime = store.advanceToTick(3_000, streams);
    const evening = store.advanceToTick(16_500, streams);
    const night = store.advanceToTick(19_500, streams);
    const nextDawn = store.advanceToTick(TICKS_PER_DAY, streams);

    expect(dawn.dayNight).toMatchObject({ day: 0, hour: 6, scheduleWindow: "dawn" });
    expect(daytime.dayNight).toMatchObject({ day: 0, hour: 8, scheduleWindow: "daytime" });
    expect(evening.dayNight).toMatchObject({ day: 0, hour: 17, scheduleWindow: "evening" });
    expect(night.dayNight).toMatchObject({
      day: 0,
      hour: 19,
      scheduleWindow: "night",
    });
    expect(nextDawn.dayNight).toMatchObject({ day: 1, hour: 6, scheduleWindow: "dawn" });
    expect(night.outdoorWorkReason).toBe("work.rejected_outdoor_night_window");
    expect(store.createMetrics().dayNightWindowTransitions).toBe(4);
  });

  it("catches up day/night windows so jumped and stepped advancement match", () => {
    const stepped = new DayNightStore();
    const jumped = new DayNightStore();
    const steppedDirty = new M3EnvironmentDirtyQueue();
    const jumpedDirty = new M3EnvironmentDirtyQueue();
    const steppedKeys: M3EnvironmentDirtyKey[] = [];
    const jumpedKeys: M3EnvironmentDirtyKey[] = [];

    stepped.advanceToTick(0, steppedDirty);
    stepped.advanceToTick(3_000, steppedDirty);
    stepped.advanceToTick(16_500, steppedDirty);
    stepped.advanceToTick(19_500, steppedDirty);
    const steppedProjection = stepped.advanceToTick(TICKS_PER_DAY, steppedDirty);

    jumped.advanceToTick(0, jumpedDirty);
    const jumpedProjection = jumped.advanceToTick(TICKS_PER_DAY, jumpedDirty);

    steppedDirty.drain(8, steppedKeys);
    jumpedDirty.drain(8, jumpedKeys);

    expect(jumpedProjection).toStrictEqual(steppedProjection);
    expect(jumpedProjection.scheduleWindowVersion).toBe(5);
    expect(jumpedProjection.reason).toBe("daynight.window_changed");
    expect(jumped.createMetrics().dayNightWindowTransitions).toBe(
      stepped.createMetrics().dayNightWindowTransitions,
    );
    expect(jumpedKeys).toEqual(steppedKeys);
    expect(jumpedKeys).toEqual([
      "schedule.work",
      "schedule.rest",
      "need.rate",
      "mood.context",
      "read-model.environment",
    ]);
  });

  it("records explicit command-forced weather with structured context and dirty keys", () => {
    const store = createM3EnvironmentStore();
    const streams = createNamedRandomStreams({ seed: "m3-weather-command" });
    const drained: M3EnvironmentDirtyKey[] = [];

    store.advanceToTick(0, streams);
    const weather = store.forceWeather(3_000, "rain_light");
    const projection = store.advanceToTick(3_000, streams);
    const drainedCount = store.dirtyQueue.drain(8, drained);

    expect(weather).toMatchObject({
      currentWeather: "rain_light",
      previousWeather: "dry_cool",
      transitionTick: 3_000,
      commandForcedWeather: "rain_light",
      weatherSourceStreamId: M3_WEATHER_STREAM_ID,
      weatherSourceVersion: 0,
      reason: "weather.changed_by_command",
    });
    expect(projection.outdoorWorkAllowed).toBe(true);
    expect(projection.needRateModifierMilli).toBe(1_150);
    expect(projection.moodContextCode).toBe(380);
    expect(drainedCount).toBe(6);
    expect(drained).toEqual([
      "weather.exposure",
      "need.rate",
      "mood.context",
      "schedule.work",
      "schedule.rest",
      "read-model.environment",
    ]);
    expect(store.createMetrics()).toMatchObject({
      weatherCommandTransitions: 1,
      weatherStreamDraws: 0,
      dirtyBacklog: 0,
      dirtyBacklogPeak: 6,
    });
  });

  it("uses named seeded weather streams for stable scheduled transitions", () => {
    const firstStore = createM3EnvironmentStore();
    const secondStore = createM3EnvironmentStore();
    const firstStreams = createNamedRandomStreams({ seed: "m3-weather-stream" });
    const secondStreams = createNamedRandomStreams({ seed: "m3-weather-stream" });

    const first = firstStore.advanceToTick(12_000, firstStreams);
    const second = secondStore.advanceToTick(12_000, secondStreams);

    expect(first.weather).toStrictEqual(second.weather);
    expect(first.weather.weatherSourceStreamId).toBe(M3_WEATHER_STREAM_ID);
    expect(first.weather.weatherSourceVersion).toBe(4);
    expect(firstStreams.snapshot()).toStrictEqual(secondStreams.snapshot());
    expect(firstStore.createMetrics().weatherStreamDraws).toBe(4);
  });

  it("catches up scheduled weather at boundary ticks so jumped and stepped advancement match", () => {
    const stepped = new WeatherStore();
    const jumped = new WeatherStore();
    const steppedStreams = createNamedRandomStreams({ seed: "m3-weather-stream" });
    const jumpedStreams = createNamedRandomStreams({ seed: "m3-weather-stream" });
    const steppedDirty = new M3EnvironmentDirtyQueue();
    const jumpedDirty = new M3EnvironmentDirtyQueue();

    stepped.advanceToTick(0, steppedStreams, steppedDirty);
    stepped.advanceToTick(3_000, steppedStreams, steppedDirty);
    stepped.advanceToTick(6_000, steppedStreams, steppedDirty);
    stepped.advanceToTick(9_000, steppedStreams, steppedDirty);
    stepped.advanceToTick(12_000, steppedStreams, steppedDirty);
    const steppedProjection = stepped.advanceToTick(12_500, steppedStreams, steppedDirty);

    jumped.advanceToTick(0, jumpedStreams, jumpedDirty);
    const jumpedProjection = jumped.advanceToTick(12_500, jumpedStreams, jumpedDirty);

    expect(jumpedProjection).toStrictEqual(steppedProjection);
    expect(jumpedProjection.transitionTick).toBe(12_000);
    expect(jumpedProjection.reason).toBe("weather.unchanged");
    expect(jumped.createMetrics()).toStrictEqual(stepped.createMetrics());
    expect(jumpedStreams.snapshot()).toStrictEqual(steppedStreams.snapshot());
  });

  it("dirties rest schedule consumers when weather changes without a day/night transition", () => {
    const weather = new WeatherStore();
    const dirty = new M3EnvironmentDirtyQueue();
    const drained: M3EnvironmentDirtyKey[] = [];

    weather.forceWeather(1_000, "rain_light", dirty);
    dirty.drain(8, drained);

    expect(drained).toEqual([
      "weather.exposure",
      "need.rate",
      "mood.context",
      "schedule.work",
      "schedule.rest",
      "read-model.environment",
    ]);
  });

  it("builds frozen versioned read models and owner metrics without UI authority", () => {
    const store = createM3EnvironmentStore();
    const streams = createNamedRandomStreams({ seed: "m3-projection" });

    store.advanceToTick(0, streams);
    store.forceWeather(3_000, "rain_heavy");
    const projection = store.advanceToTick(3_000, streams);

    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.dayNight)).toBe(true);
    expect(Object.isFrozen(projection.weather)).toBe(true);
    expect(Object.isFrozen(projection.weather.severity)).toBe(true);
    expect(projection.version).toBe(
      projection.dayNight.scheduleWindowVersion + projection.weather.weatherVersion,
    );
    expect(projection.outdoorWorkAllowed).toBe(false);
    expect(projection.outdoorWorkReason).toBe("work.rejected_weather_exposure");
    expect(store.createMetrics()).toMatchObject({
      projectionBuilds: 2,
      weatherCommandTransitions: 1,
      weatherStreamDraws: 0,
    });
  });

  it("replays the same command stream and exposes sorted-command rejection reasons", () => {
    const commands: readonly M3EnvironmentCommand[] = [
      { tick: 3_000, kind: "weather.force", weather: "rain_light" },
    ];
    const checkpoints = [0, 3_000, 7_200, 19_500, 36_000];
    const first = runM3EnvironmentReplay({
      ticks: 36_000,
      streams: createNamedRandomStreams({ seed: "46" }),
      commands,
      checkpoints,
    });
    const second = runM3EnvironmentReplay({
      ticks: 36_000,
      streams: createNamedRandomStreams({ seed: "46" }),
      commands,
      checkpoints,
    });
    const rejected = runM3EnvironmentReplay({
      ticks: 4_000,
      streams: createNamedRandomStreams({ seed: "46" }),
      commands: [
        { tick: 3_000, kind: "weather.force", weather: "rain_light" },
        { tick: 1_000, kind: "weather.force", weather: "dry_cool" },
      ],
      checkpoints,
    });

    expect(first).toStrictEqual(second);
    expect(first.ok).toBe(true);
    expect(first.metrics.weatherCommandTransitions).toBe(1);
    expect(first.metrics.weatherStreamDraws).toBe(0);
    expect(first.checkpoints[1]?.projection.weather.reason).toBe("weather.unchanged");
    expect(first.checkpoints[3]?.projection.outdoorWorkReason).toBe(
      "work.rejected_outdoor_night_window",
    );
    expect(rejected).toMatchObject({
      ok: false,
      reason: "environment.command_stream_not_sorted",
    });
  });
});
