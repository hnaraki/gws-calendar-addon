
function onApplyPrompt(e) {
  const formInputs = e.commonEventObject.formInputs;
  const promptText = formInputs && formInputs.prompt ? formInputs.prompt.stringInputs.value[0] : "";
  
  let newValues = {
    guests: formInputs && formInputs.guests ? formInputs.guests.stringInputs.value[0] : "",
    duration: formInputs && formInputs.duration ? formInputs.duration.stringInputs.value[0] : "30",
    startTimeMs: safeGetStartTimeMs(formInputs),
    location: formInputs && formInputs.location ? formInputs.location.stringInputs.value[0] : "",
    description: formInputs && formInputs.description ? formInputs.description.stringInputs.value[0] : ""
  };

  // 簡易解析
  const durationMatch = promptText.match(/(15|30|60|90|120)\s*分/);
  if (durationMatch) {
    newValues.duration = durationMatch[1];
  }

  const locMatch = promptText.match(/(\S+)(で|にて)/);
  if (locMatch) {
    newValues.location = locMatch[1];
  }

  if (promptText.includes("について")) {
     newValues.description = promptText + "\n(AIにより自動追記)";
  }

  if (promptText.includes("明日") && newValues.startTimeMs) {
    const d = new Date(parseInt(newValues.startTimeMs));
    d.setDate(d.getDate() + 1);
    newValues.startTimeMs = d.getTime();
  }

  // デバッグログ
  Logger.log("onApplyPrompt newValues: %s", JSON.stringify(newValues));
  console.log("onApplyPrompt newValues:", JSON.stringify(newValues));

  const newCard = buildCard(newValues, "✅ プロンプトの内容を反映しました");
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(newCard))
    .build();
}
/**
 * アクション: ゲスト入力欄で'@'が入力されたときにドメインを補完する
 */
function onGuestInputChange(e) {
  const formInputs = e.commonEventObject.formInputs;
  const guestValue = formInputs.guests ? formInputs.guests.stringInputs.value[0] : "";

  // 現在のフォーム全体の入力値を保持する
  const currentValues = {
    title: formInputs.title ? formInputs.title.stringInputs.value[0] : "",
    guests: guestValue,
    duration: formInputs.duration ? formInputs.duration.stringInputs.value[0] : "30",
    startTimeMs: formInputs.startTimeMs ? formInputs.startTimeMs.dateInput.msSinceEpoch : null,
    location: formInputs.location ? formInputs.location.stringInputs.value[0] : "",
    description: formInputs.description ? formInputs.description.stringInputs.value[0] : "",
    prompt: formInputs.prompt ? formInputs.prompt.stringInputs.value[0] : ""
  };

  // カンマ区切りで最後のメールアドレス部分を取得
  const guestParts = guestValue.split(',').map(s => s.trim());
  const lastPart = guestParts[guestParts.length - 1];

  // 最後のメールアドレスが'@'で終わり、かつドメインがまだ補完されていない場合に補完する
  if (lastPart.endsWith('@') && !lastPart.endsWith('@lycorp.co.jp')) {
    guestParts[guestParts.length - 1] = lastPart + 'lycorp.co.jp';
    currentValues.guests = guestParts.join(', ');
  }

  // 補完した値でカードを再描画
  const newCard = buildCard(currentValues);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(newCard))
    .build();
}

/**
 * アクション: 最終的にカレンダーイベントを作成する
 */
function onCreateEvent(e) {
  const formInputs = (e && e.commonEventObject && e.commonEventObject.formInputs) || {};

  const title = formInputs.title ? formInputs.title.stringInputs.value[0] : "（タイトルなし）";
  const guests = formInputs.guests ? formInputs.guests.stringInputs.value[0] : "";
  const durationMin = parseInt(formInputs.duration ? formInputs.duration.stringInputs.value[0] : "30");
  const startTimeMs = (formInputs.startTimeMs && formInputs.startTimeMs.dateInput && formInputs.startTimeMs.dateInput.msSinceEpoch)
    ? parseInt(formInputs.startTimeMs.dateInput.msSinceEpoch)
    : null;
  const location = formInputs.location ? formInputs.location.stringInputs.value[0] : "";
  const description = formInputs.description ? formInputs.description.stringInputs.value[0] : "";

  // ログ出力（Apps Script の実行ログ / Cloud Logging に出ます）
  Logger.log("onCreateEvent inputs: %s", JSON.stringify({ title, startTimeMs, durationMin, guests, location, description }));
  console.log("onCreateEvent inputs:", { title, startTimeMs, durationMin, guests, location, description });

  // デバッグ表示（UI上に短い通知を出す）
  const debugText = [
    "title: " + title,
    "start: " + (startTimeMs ? new Date(startTimeMs).toString() : "(missing)"),
    "durationMin: " + durationMin,
    "guests: " + guests
  ].join(" | ");

  const DEBUG = true; // デバッグ時は true、本番でイベント作成する場合は false にする
  if (DEBUG) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(debugText))
      .build();
  }

  // ---------- 以下が実際のイベント作成処理 ----------
  const startTime = new Date(startTimeMs || Date.now());
  const endTime = new Date(startTime.getTime() + (durationMin * 60 * 1000));

  if (!DEBUG) {
  try {
    const options = {
      location: location,
      description: description,
      guests: guests
    };

    const event = CalendarApp.createEvent(
      title,
      startTime,
      endTime,
      options
    );

    const successCard = buildCard({}, `🎉 予定を作成しました: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("イベントを作成しました"))
      .setNavigation(CardService.newNavigation().updateCard(successCard))
      .build();

  } catch (err) {
    Logger.log("onCreateEvent error: %s", err.toString());
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("エラー: " + err.toString()))
      .build();
  }
  }