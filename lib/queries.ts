const S = process.env.HANA_SCHEMA ?? 'DBADMIN';

function since(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

export const sql = {
  // ── Volume ────────────────────────────────────────────────────────────────
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

  // ── Anomalies ─────────────────────────────────────────────────────────────
  anomalies: (hours: number) => `
    SELECT "anomaly_id","detected_at","bucket_start","anomaly_type",
           "severity","anomaly_score","n_requests","n_unique_ips",
           "error_rate","top_ip","reason","details_json","attack_category"
    FROM "${S}"."ANOMALIES"
    WHERE "bucket_start" >= '${since(hours)}'
    ORDER BY "bucket_start" ASC
  `,

  // ── System Logs stats — ONE value per query (most resilient approach) ─────
  systemLogsTotal: (hours: number) => `
    SELECT COUNT(*) AS v
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
  `,
  systemLogsUniqueIps: (hours: number) => `
    SELECT COUNT(DISTINCT "sourceip") AS v
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
  `,
  systemLogsSecEvents: (hours: number) => `
    SELECT COUNT(*) AS v
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
      AND "is_security_event" IS NOT NULL
      AND CAST("is_security_event" AS TINYINT) = 1
  `,

  // ── System Logs distributions ─────────────────────────────────────────────
  systemLogsLogtypeDist: (hours: number) => `
    SELECT "logtype" AS name, COUNT(*) AS value
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "logtype" ORDER BY value DESC
  `,
  systemLogsHttpStatusDist: (hours: number) => `
    SELECT TO_VARCHAR("http_status_code") AS name, COUNT(*) AS value
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "http_status_code" ORDER BY "http_status_code"
  `,
  systemLogsTopIps: (hours: number) => `
    SELECT "sourceip" AS name, COUNT(*) AS value
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "sourceip" ORDER BY value DESC
    LIMIT 10
  `,
  systemLogsEnvDist: (hours: number) => `
    SELECT "sap_app_env" AS name, COUNT(*) AS value
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "sap_app_env" ORDER BY value DESC
  `,
  systemLogsRegionDist: (hours: number) => `
    SELECT "macro_region" AS name, COUNT(*) AS value
    FROM "${S}"."SYSTEM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "macro_region" ORDER BY value DESC
    LIMIT 20
  `,

  // ── System Logs paginated rows — ROW_NUMBER avoids LIMIT/OFFSET issues ────
  systemLogsPage: (hours: number, offset: number, limit = 100) => `
    SELECT "_id","timestamp","sourceip","port_service","event_description",
           "status","logtype","region_id","region_name","region_code",
           "macro_region","_score","headers_http_request_method",
           "sap_app_env","http_status_code","is_security_event"
    FROM (
      SELECT "_id","timestamp","sourceip","port_service","event_description",
             "status","logtype","region_id","region_name","region_code",
             "macro_region","_score","headers_http_request_method",
             "sap_app_env","http_status_code","is_security_event",
             ROW_NUMBER() OVER (ORDER BY "timestamp" DESC) AS "_rn"
      FROM "${S}"."SYSTEM_LOGS"
      WHERE "timestamp" >= '${since(hours)}'
    )
    WHERE "_rn" > ${offset} AND "_rn" <= ${offset + limit}
  `,

  // ── LLM Logs stats — ONE value per query ──────────────────────────────────
  llmLogsTotal: (hours: number) => `
    SELECT COUNT(*) AS v
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
  `,
  llmLogsTotalCost: (hours: number) => `
    SELECT SUM("llm_cost_usd") AS v
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
  `,
  llmLogsTotalTokens: (hours: number) => `
    SELECT SUM("llm_total_tokens") AS v
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
  `,
  llmLogsAvgLatency: (hours: number) => `
    SELECT AVG(CAST("llm_response_time_ms" AS DOUBLE)) AS v
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
      AND "llm_response_time_ms" IS NOT NULL
  `,

  // ── LLM Logs distributions ────────────────────────────────────────────────
  llmLogsModelDist: (hours: number) => `
    SELECT "llm_model_id" AS name, COUNT(*) AS value
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "llm_model_id" ORDER BY value DESC
  `,
  /** Latency avg per model — p95 computed separately to avoid PERCENTILE_CONT issues */
  llmLogsAvgByModel: (hours: number) => `
    SELECT "llm_model_id" AS name,
           AVG(CAST("llm_response_time_ms" AS DOUBLE)) AS avg,
           COUNT(*) AS count
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
      AND "llm_response_time_ms" IS NOT NULL
    GROUP BY "llm_model_id"
    ORDER BY count DESC
  `,
  /** p95 latency per model via PERCENTILE_CONT (may not be available in all HANA versions) */
  llmLogsP95ByModel: (hours: number) => `
    SELECT "llm_model_id" AS name,
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST("llm_response_time_ms" AS DOUBLE)) AS p95
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
      AND "llm_response_time_ms" IS NOT NULL
    GROUP BY "llm_model_id"
  `,
  llmLogsCostByRegion: (hours: number) => `
    SELECT "macro_region" AS name, SUM("llm_cost_usd") AS value
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "macro_region" ORDER BY value DESC
  `,
  llmLogsFinishDist: (hours: number) => `
    SELECT "llm_finish_reason" AS name, COUNT(*) AS value
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "llm_finish_reason" ORDER BY value DESC
  `,
  llmLogsRegionDist: (hours: number) => `
    SELECT "macro_region" AS name, COUNT(*) AS value
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
    GROUP BY "macro_region" ORDER BY value DESC
    LIMIT 20
  `,

  // ── LLM Logs paginated rows — ROW_NUMBER ─────────────────────────────────
  llmLogsPage: (hours: number, offset: number, limit = 100) => `
    SELECT "_id","timestamp","port_service","event_description","status",
           "logtype","region_id","region_name","region_code","macro_region",
           "sap_llm_response_time","sap_llm_response_size","llm_cost_usd",
           "_score","headers_http_request_method","llm_model_id","sap_app_env",
           "llm_finish_reason","llm_temperature","llm_response_time_ms",
           "llm_total_tokens","llm_status","llm_prompt"
    FROM (
      SELECT "_id","timestamp","port_service","event_description","status",
             "logtype","region_id","region_name","region_code","macro_region",
             "sap_llm_response_time","sap_llm_response_size","llm_cost_usd",
             "_score","headers_http_request_method","llm_model_id","sap_app_env",
             "llm_finish_reason","llm_temperature","llm_response_time_ms",
             "llm_total_tokens","llm_status","llm_prompt",
             ROW_NUMBER() OVER (ORDER BY "timestamp" DESC) AS "_rn"
      FROM "${S}"."LLM_LOGS"
      WHERE "timestamp" >= '${since(hours)}'
    )
    WHERE "_rn" > ${offset} AND "_rn" <= ${offset + limit}
  `,

  llmLogsPrompts: (hours: number, limit = 50) => `
    SELECT "_id","timestamp","llm_model_id","llm_prompt"
    FROM "${S}"."LLM_LOGS"
    WHERE "timestamp" >= '${since(hours)}'
      AND "llm_prompt" IS NOT NULL
      AND "llm_prompt" <> ''
    ORDER BY "timestamp" DESC
    LIMIT ${limit}
  `,
};
