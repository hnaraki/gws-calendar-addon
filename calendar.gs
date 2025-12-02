/**
 * アドオン起動時（ホームページ）のエントリーポイント
 */
function onHomepage(e) {
  return buildCard();
}

/**
 * カード構築のメイン関数
 * @param {Object} defaultValues - 再描画時にセットするデフォルト値
 * @param {String} statusMessage - ユーザーへの通知メッセージ
 */
function buildCard(defaultValues = {}, statusMessage = "") {
  const card = CardService.newCardBuilder();

  // --- ヘッダー設定 ---
  const header = CardService.newCardHeader()
    .setTitle("スマート会議スケジューラ")
    //.setSubtitle("AIプロンプトで入力を補助");
  card.setHeader(header);

  // --- 1. 入力セクション (ゲスト、時間、日時) ---
  const section1 = CardService.newCardSection();

// 1-0. 会議タイトル入力欄（★追加箇所★）
  const titleValue = defaultValues.title || "";
  const titleInput = CardService.newTextInput()
    .setFieldName("title")
    .setTitle("会議タイトル")
    .setHint("例: 新製品アイデア出しミーティング")
    .setValue(titleValue);
  
  // 1-1. ゲスト入力 (カンマ区切りで複数対応)
  const guestValue = defaultValues.guests || "";
  const guestInput = CardService.newTextInput()
    .setFieldName("guests")
    .setTitle("ゲスト (メールアドレス)")
    .setHint("user1@example.com, user2@example.com")
    .setValue(guestValue);

  // 1-2. 会議時間 (デフォルト30分)
  const durationValue = defaultValues.duration || "30";
  const durationInput = CardService.newSelectionInput()
    .setFieldName("duration")
    .setTitle("会議時間")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem("15分", "15", durationValue === "15")
    .addItem("30分", "30", durationValue === "30")
    .addItem("60分", "60", durationValue === "60")
    .addItem("90分", "90", durationValue === "90")
    .addItem("120分", "120", durationValue === "120");

// 1-3. 日時 (デフォルトは10:00)
  let defaultDateMs;
  if (defaultValues.startTimeMs) {
    defaultDateMs = parseInt(defaultValues.startTimeMs);
  } else {
    const now = new Date();
    // 基準時刻を今日の10:00に設定
    const today10AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0);
    
    // 現在時刻が10:00を過ぎていたら、明日10:00に設定
    if (now.getTime() > today10AM.getTime()) {
      today10AM.setDate(today10AM.getDate() + 1);
    }
    
    defaultDateMs = today10AM.getTime();
  }
  
  // DateTimePickerの再導入（修正済みの構文）
  const dateTimeInput = CardService.newDateTimePicker(); 
  dateTimeInput.setFieldName("startTimeMs"); 
  dateTimeInput.setTitle("開始日時");
  //dateTimeInput.setValueInMs(defaultDateMs); 
  
  section1.addWidget(titleInput);
  section1.addWidget(guestInput);
  section1.addWidget(durationInput);
  section1.addWidget(dateTimeInput);
  card.addSection(section1);

  // --- 2. 詳細セクション (場所、説明) ---
  const section2 = CardService.newCardSection();

  // 2-1. 場所
  const locationValue = defaultValues.location || "";
  const locationInput = CardService.newTextInput()
    .setFieldName("location")
    .setTitle("会議室または場所")
    .setValue(locationValue);

  // 2-2. 説明
  const descValue = defaultValues.description || "";
  const descInput = CardService.newTextInput()
    .setFieldName("description")
    .setTitle("説明")
    .setMultiline(true)
    .setValue(descValue);

  section2.addWidget(locationInput);
  section2.addWidget(descInput);
  card.addSection(section2);

  // --- 3. プロンプト入力セクション ---
  const section3 = CardService.newCardSection()
    .setHeader("🤖 AIアシスタント");

  const promptInput = CardService.newTextInput()
    .setFieldName("prompt")
    .setTitle("指示を入力して反映")
    .setHint("例: 「明日の14時から60分、渋谷でランチMTG」");

  // アクション: プロンプトを解析してフォームに反映する
  const updateAction = CardService.newAction().setFunctionName("onApplyPrompt");
  const updateButton = CardService.newTextButton()
    .setText("↑ 上記の内容をフォームに反映")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(updateAction);

  section3.addWidget(promptInput);
  section3.addWidget(updateButton);
  card.addSection(section3);

  // --- 4. フッター (イベント作成ボタン) ---
  const footerSection = CardService.newCardSection();
  const createAction = CardService.newAction().setFunctionName("onCreateEvent");
  const createButton = CardService.newTextButton()
    .setText("カレンダーに予定を作成")
    .setOnClickAction(createAction);
  
  // ステータスメッセージがあれば表示
  if (statusMessage) {
    const msgWidget = CardService.newTextParagraph().setText(`<b>${statusMessage}</b>`);
    footerSection.addWidget(msgWidget);
  }
  
  footerSection.addWidget(createButton);
  card.addSection(footerSection);

  return card.build();
}

/**
 * アクション: プロンプト入力に基づいてフォームを更新する
 * (注: ここではデモ用に簡易的なキーワード解析を行っています)
 */
function onApplyPrompt(e) {
  const formInputs = e.commonEventObject.formInputs;
  const promptText = formInputs.prompt ? formInputs.prompt.stringInputs.value[0] : "";
  
  // 現在の入力値を保持するためのオブジェクト
  let newValues = {
    guests: formInputs.guests ? formInputs.guests.stringInputs.value[0] : "",
    duration: formInputs.duration ? formInputs.duration.stringInputs.value[0] : "30",
    startTimeMs: formInputs.startTimeMs ? formInputs.startTimeMs.dateInput.msSinceEpoch : null,
    location: formInputs.location ? formInputs.location.stringInputs.value[0] : "",
    description: formInputs.description ? formInputs.description.stringInputs.value[0] : ""
  };

  // --- 簡易AI解析ロジック (ここを実際のLLM API等に置き換えることができます) ---
  
  // 1. 時間の解析 ("60分" などが含まれていれば反映)
  const durationMatch = promptText.match(/(15|30|60|90|120)\s*分/);
  if (durationMatch) {
    newValues.duration = durationMatch[1];
  }

  // 2. 場所の解析 ("で" の前の単語を簡易的に抽出、または "場所は～")
  // デモ: "渋谷で" や "会議室Aで" のようなパターン
  const locMatch = promptText.match(/(\S+)(で|にて)/);
  if (locMatch) {
    newValues.location = locMatch[1];
  }

  // 3. 説明への反映 (プロンプト自体を説明に追加してみる)
  if (promptText.includes("について")) {
     newValues.description = promptText + "\n(AIにより自動追記)";
  }

  // 4. 日付解析 (デモ: "明日"が含まれていれば+1日する)
  if (promptText.includes("明日") && newValues.startTimeMs) {
    const d = new Date(parseInt(newValues.startTimeMs));
    d.setDate(d.getDate() + 1);
    newValues.startTimeMs = d.getTime();
  }

  // -------------------------------------------------------------

  // カードを再構築して更新
  const newCard = buildCard(newValues, "✅ プロンプトの内容を反映しました");
  
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(newCard))
    .build();
}

/**
 * アクション: 最終的にカレンダーイベントを作成する
 */
function onCreateEvent(e) {
  const formInputs = e.commonEventObject.formInputs;

  // 値の取得
  const guests = formInputs.guests ? formInputs.guests.stringInputs.value[0] : "";
  const durationMin = parseInt(formInputs.duration ? formInputs.duration.stringInputs.value[0] : "30");
  const startTimeMs = parseInt(formInputs.startTimeMs.dateInput.msSinceEpoch);
  const location = formInputs.location ? formInputs.location.stringInputs.value[0] : "";
  const description = formInputs.description ? formInputs.description.stringInputs.value[0] : "";

  // 終了時間の計算
  const startTime = new Date(startTimeMs);
  const endTime = new Date(startTime.getTime() + (durationMin * 60 * 1000));

  try {
    // イベント作成
    const options = {
      location: location,
      description: description,
      guests: guests
    };

    const event = CalendarApp.createEvent(
      "新規ミーティング", // タイトル(必要であれば入力欄を追加してください)
      startTime,
      endTime,
      options
    );

    // 成功通知とカードのリセット
    const successCard = buildCard({}, `🎉 予定を作成しました: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("イベントを作成しました"))
      .setNavigation(CardService.newNavigation().updateCard(successCard))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("エラー: " + err.toString()))
      .build();
  }
}
