const DEFAULT_GUEST_DOMAIN = "lycorp.co.jp";

/**
 * formInputs から安全に startTimeMs (ミリ秒) を取得
 * 戻り値: number | null
 */
function safeGetStartTimeMs(formInputs) {
  try {
    if (formInputs && formInputs.startTimeMs && formInputs.startTimeMs.dateInput && formInputs.startTimeMs.dateInput.msSinceEpoch) {
      return parseInt(formInputs.startTimeMs.dateInput.msSinceEpoch);
    }
  } catch (e) {
    // ignore
  }
  return null;
}