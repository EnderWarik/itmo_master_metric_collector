export enum MetricGroup {
  Server = 'server',
  Browser = 'browser',
}

export interface MetricDefinition {
  key: string;
  label: string;
  group: MetricGroup;
  description?: string;
}

export interface MetricResult<TPayload = unknown> {
  key: string;
  label: string;
  group: MetricGroup;
  description?: string;
  payload: TPayload;
  collectedAt: Date;
}

export interface MetricCollector<TPayload = unknown> extends MetricDefinition {
  collect(url: string): Promise<MetricResult<TPayload>>;
}
