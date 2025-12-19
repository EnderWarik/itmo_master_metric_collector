export interface MetricDefinition {
  key: string;
  label: string;
  description?: string;
}

export interface MetricResult<TPayload = unknown> {
  key: string;
  label: string;
  description?: string;
  payload: TPayload;
  collectedAt: string;
}

