const S = process.env.HANA_SCHEMA ?? 'DBADMIN';

function since(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

export const sql = {
  volume: (table: string, hours: number) => `
    SELECT
      TO_VARCHAR("timestamp", 'YYYY-MM-DD HH24:MI') AS minute_str,
      "logtype",
      COUNT(*) AS cnt
    FROM "${S}"."${table}"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY TO_VARCHAR("timestamp", 'YYYY-MM-DD HH24:MI'), "logtype"
    ORDER BY minute_str
  `,

  anomalies: (hours: number) => `
    SELECT "anomaly_id","detected_at","bucket_start","anomaly_type",
           "severity","anomaly_score","n_requests","n_unique_ips",
           "error_rate","top_ip","reason","details_json","attack_category"
    FROM "${S}"."ANOMALIES"
    WHERE "bucket_start" >= '${since(hours)}'
    ORDER BY "bucket_start" ASC
  `,

  systemLogs: (hours: number) => `
    SELECT "_id","timestamp","sourceip","port_service","event_description",
           "status","logtype","region_id","region_name","region_code",
           "macro_region","_score","headers_http_request_method",
           "sap_app_env","http_status_code","is_security_event"
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    ORDER BY "timestamp" DESC
  `,

  llmLogs: (hours: number) => `
    SELECT "_id","timestamp","port_service","event_description","status",
           "logtype","region_id","region_name","region_code","macro_region",
           "sap_llm_response_time","sap_llm_response_size","llm_cost_usd",
           "_score","headers_http_request_method","llm_model_id","sap_app_env",
           "llm_finish_reason","llm_temperature","llm_response_time_ms",
           "llm_total_tokens","llm_status","llm_prompt"
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    ORDER BY "timestamp" DESC
  `,
};
