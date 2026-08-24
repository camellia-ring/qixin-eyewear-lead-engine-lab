export const DISCOVERY_RUNTIME_CONFIG = Object.freeze({
  batchCandidates: 20,
  initialConcurrency: 3,
  maxConcurrency: 5,
  degradedConcurrency: 2,
  minimumConcurrency: 1,
  stableSuccessesPerStep: 4,
  errorWindowSize: 6,
  degradedErrorRate: 0.25,
  severeErrorRate: 0.5,
  staleRunMinutes: 12,
});

export type ConcurrencyOutcome = "success" | "error" | "timeout" | "throttled";

export function classifyConcurrencyError(error: unknown): ConcurrencyOutcome {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error || "");
  if (/HTTP\s*(403|429)|too many requests|rate.?limit|限流/i.test(message)) return "throttled";
  if (/abort|timeout|timed out|超时/i.test(message)) return "timeout";
  return "error";
}

export class AdaptiveConcurrencyController {
  private currentValue: number;
  private stableSuccesses = 0;
  private readonly recentFailures: boolean[] = [];

  constructor(private readonly config = DISCOVERY_RUNTIME_CONFIG) {
    this.currentValue = config.initialConcurrency;
  }

  get current() { return this.currentValue; }

  record(outcome: ConcurrencyOutcome) {
    const failed = outcome !== "success";
    this.recentFailures.push(failed);
    if (this.recentFailures.length > this.config.errorWindowSize) this.recentFailures.shift();

    if (outcome === "throttled") {
      this.currentValue = this.config.minimumConcurrency;
      this.stableSuccesses = 0;
      return this.currentValue;
    }
    if (outcome === "timeout") {
      this.currentValue = Math.min(this.currentValue, this.config.degradedConcurrency);
      this.stableSuccesses = 0;
      return this.currentValue;
    }

    const errorRate = this.recentFailures.filter(Boolean).length / this.recentFailures.length;
    if (errorRate >= this.config.severeErrorRate) {
      this.currentValue = this.config.minimumConcurrency;
      this.stableSuccesses = 0;
      return this.currentValue;
    }
    if (errorRate >= this.config.degradedErrorRate) {
      this.currentValue = Math.min(this.currentValue, this.config.degradedConcurrency);
      this.stableSuccesses = 0;
      return this.currentValue;
    }

    if (outcome === "success") {
      this.stableSuccesses += 1;
      if (this.stableSuccesses >= this.config.stableSuccessesPerStep && this.currentValue < this.config.maxConcurrency) {
        this.currentValue += 1;
        this.stableSuccesses = 0;
      }
    } else {
      this.stableSuccesses = 0;
    }
    return this.currentValue;
  }
}

export type AdaptivePoolResult<T> = {
  results: PromiseSettledResult<T>[];
  initialConcurrency: number;
  finalConcurrency: number;
  maxObservedConcurrency: number;
  concurrencyHistory: number[];
};

export async function runAdaptivePool<Input, Output>(
  inputs: readonly Input[],
  worker: (input: Input, index: number) => Promise<Output>,
  options: {
    controller?: AdaptiveConcurrencyController;
    classifyResult?: (result: Output) => ConcurrencyOutcome;
  } = {},
): Promise<AdaptivePoolResult<Output>> {
  const controller = options.controller || new AdaptiveConcurrencyController();
  const initialConcurrency = controller.current;
  const results = new Array<PromiseSettledResult<Output>>(inputs.length);
  const concurrencyHistory = [controller.current];
  let nextIndex = 0;
  let active = 0;
  let maxObservedConcurrency = 0;

  await new Promise<void>((resolve) => {
    const pump = () => {
      while (active < controller.current && nextIndex < inputs.length) {
        const index = nextIndex;
        nextIndex += 1;
        active += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, active);
        void (async () => {
          try {
            const value = await worker(inputs[index], index);
            results[index] = { status: "fulfilled", value };
            const before = controller.current;
            controller.record(options.classifyResult?.(value) || "success");
            if (controller.current !== before) concurrencyHistory.push(controller.current);
          } catch (reason) {
            results[index] = { status: "rejected", reason };
            const before = controller.current;
            controller.record(classifyConcurrencyError(reason));
            if (controller.current !== before) concurrencyHistory.push(controller.current);
          } finally {
            active -= 1;
            if (nextIndex >= inputs.length && active === 0) resolve();
            else pump();
          }
        })();
      }
      if (!inputs.length) resolve();
    };
    pump();
  });

  return {
    results,
    initialConcurrency,
    finalConcurrency: controller.current,
    maxObservedConcurrency,
    concurrencyHistory,
  };
}

export class KeyedSerialExecutor {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) || Promise.resolve();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.tails.set(key, tail);
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}

function domainKey(urlValue: string) {
  try { return new URL(urlValue).hostname.toLocaleLowerCase().replace(/^www\./, ""); }
  catch { return urlValue.toLocaleLowerCase(); }
}

export class PerDomainRateLimiter {
  private readonly serial = new KeyedSerialExecutor();
  private readonly nextAllowedAt = new Map<string, number>();

  constructor(
    private readonly delayMs: number,
    private readonly resolveKey: (url: string) => string = domainKey,
  ) {}

  run<T>(url: string, task: () => Promise<T>) {
    const key = this.resolveKey(url) || domainKey(url);
    return this.serial.run(key, async () => {
      const waitMs = Math.max(0, (this.nextAllowedAt.get(key) || 0) - Date.now());
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.nextAllowedAt.set(key, Date.now() + this.delayMs);
      return task();
    });
  }
}

export class ContiguousProgress {
  private readonly completed = new Set<number>();
  private nextIndex = 0;

  constructor(private readonly baseOffset: number) {}

  complete(index: number) {
    this.completed.add(index);
    while (this.completed.delete(this.nextIndex)) this.nextIndex += 1;
    return this.baseOffset + this.nextIndex;
  }
}
