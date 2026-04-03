import { getDefaultTravelBufferMinutes, getEnv } from "./config.js";

export type TravelTimeRequest = {
  fromLocation?: string;
  toLocation?: string;
  defaultBufferMinutes: number;
};

export type TravelTimeResult = {
  minutes: number;
  source: "distance_matrix" | "fixed_buffer";
};

/**
 * MVP: location が無い/未対応の場合は固定バッファ。
 * 将来: Google Distance Matrix API で移動時間を計算（GOOGLE_MAPS_API_KEY がある場合）。
 */
export async function estimateTravelMinutes(req: TravelTimeRequest): Promise<TravelTimeResult> {
  const env = getEnv();
  const fallback = Math.max(0, Math.floor(req.defaultBufferMinutes));

  if (!req.fromLocation || !req.toLocation) {
    return { minutes: fallback, source: "fixed_buffer" };
  }

  if (!env.GOOGLE_MAPS_API_KEY) {
    return { minutes: fallback, source: "fixed_buffer" };
  }

  // 最初の実装では外部API呼び出しはまだ行わない（キー管理・課金・レート制御が絡むため）。
  // ここは固定バッファにフォールバックして、後続でDistance Matrixを実装できるように接口だけ用意する。
  return { minutes: fallback, source: "fixed_buffer" };
}

export function getDefaultBufferMinutes(): number {
  return getDefaultTravelBufferMinutes();
}

