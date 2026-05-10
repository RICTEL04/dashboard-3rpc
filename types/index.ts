export interface VolumeRow {
  minute_str: string;
  logtype: string;
  cnt: number;
}

export interface SystemLog {
  _id: string;
  timestamp: string;
  sourceip: string;
  port_service: string;
  event_description: string;
  status: string;
  logtype: string;
  region_id: string;
  region_name: string;
  region_code: string;
  macro_region: string;
  _score: number;
  headers_http_request_method: string;
  sap_app_env: string;
  http_status_code: number;
  is_security_event: number;
}

export interface LlmLog {
  _id: string;
  timestamp: string;
  port_service: string;
  event_description: string;
  status: string;
  logtype: string;
  region_id: string;
  region_name: string;
  region_code: string;
  macro_region: string;
  sap_llm_response_time: number;
  sap_llm_response_size: number;
  llm_cost_usd: number;
  _score: number;
  headers_http_request_method: string;
  llm_model_id: string;
  sap_app_env: string;
  llm_finish_reason: string;
  llm_temperature: number;
  llm_response_time_ms: number;
  llm_total_tokens: number;
  llm_status: string;
  llm_prompt: string;
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
export type AnomalyType = 'SPIKE' | 'MULTI_BUCKET' | 'CATEGORIZATION';

export interface Anomaly {
  anomaly_id: string;
  detected_at: string;
  bucket_start: string;
  anomaly_type: AnomalyType;
  severity: Severity;
  anomaly_score: number;
  n_requests: number;
  n_unique_ips: number;
  error_rate: number;
  top_ip: string;
  reason: string;
  details_json: string;
  attack_category: string;
}

export interface TopDeviation {
  label: string;
  value: number;
  baseline: number;
  z_score: number;
  direction: string;
}

export interface AnomalyDetails {
  top_deviations?: TopDeviation[];
  feature_snapshot?: Record<string, unknown>;
  sys_log_ids?: string[];
  llm_log_ids?: string[];
}
