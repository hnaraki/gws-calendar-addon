// テスト（GASUnit でも実行できるよう、簡易アサーションを自前で用意）
function _assertEquals(expected, actual, msg) {
  if (typeof GASUnit !== 'undefined' && GASUnit && GASUnit.assertEqual) {
    // GASUnit があればそれを使う
    GASUnit.assertEqual(expected, actual, msg || '');
    return;
  }
  if (expected !== actual) {
    throw new Error('Assertion failed' + (msg ? ': ' + msg : '') + ' (expected: ' + expected + ', actual: ' + actual + ')');
  }
}

// テスト用ユーティリティ（スタブのリセットに使う）
var _orig = {};

/**
 * onApplyPrompt が newValues を正しく作ることを確認する
 */
function test_onApplyPrompt_parses_prompt() {
  // setup: stub buildCard をキャプチャ用に差し替え
  _orig.buildCard = this.buildCard;
  var captured = {};
  this.buildCard = function(values, status) {
    captured.values = values;
    captured.status = status;
    return CardService.newCardBuilder().build(); // return real Card object
  };

  // イベントオブジェクト（prompt に「明日 60分 渋谷で」を含める）
  var nowMs = Date.now();
  var e = {
    commonEventObject: {
      formInputs: {
        prompt: { stringInputs: { value: ["明日 60分 渋谷で"] } },
        guests: { stringInputs: { value: ["bob@example.com"] } },
        duration: { stringInputs: { value: ["30"] } },
        startTimeMs: { dateInput: { msSinceEpoch: String(nowMs) } },
        location: { stringInputs: { value: [""] } },
        description: { stringInputs: { value: [""] } }
      }
    }
  };

  // 実行
  onApplyPrompt(e);

  // 検証
  _assertEquals("60", captured.values.duration, "duration should be parsed to 60");
  _assertEquals("渋谷", captured.values.location, "location should be parsed to 渋谷");

  var origDate = new Date(parseInt(nowMs));
  var expectedTomorrowMs = new Date(origDate.getFullYear(), origDate.getMonth(), origDate.getDate() + 1, origDate.getHours(), origDate.getMinutes(), origDate.getSeconds(), origDate.getMilliseconds()).getTime();
  // onApplyPrompt は元 ms を丸ごと +1日するため、日付比較で概ね正しいことを確認
  var gotMs = parseInt(captured.values.startTimeMs);
  if (!(Math.abs(gotMs - (nowMs + 24*60*60*1000)) < 1000*60*60)) {
    throw new Error("startTimeMs should be shifted ~+1day (got: " + gotMs + ")");
  }

  // teardown
  this.buildCard = _orig.buildCard;
}

/**
 * onGuestInputChange が '@' で終わる最後のエントリにドメインを補完することを確認する
 */
function test_onGuestInputChange_appends_domain() {
  _orig.buildCard = this.buildCard;
  var captured = {};
  this.buildCard = function(values /*, status */) {
    captured.values = values;
    return CardService.newCardBuilder().build(); // return real Card object
  };

  var e = {
    commonEventObject: {
      formInputs: {
        guests: { stringInputs: { value: ["alice@"] } },
        title: { stringInputs: { value: ["t"] } },
        duration: { stringInputs: { value: ["30"] } },
        startTimeMs: { dateInput: { msSinceEpoch: String(Date.now()) } },
        location: { stringInputs: { value: [""] } },
        description: { stringInputs: { value: [""] } },
        prompt: { stringInputs: { value: [""] } }
      }
    }
  };

  onGuestInputChange(e);

  // 期待: alice@lycorp.co.jp
  _assertEquals("alice@lycorp.co.jp", captured.values.guests, "domain should be appended");

  this.buildCard = _orig.buildCard;
}

/**
 * onCreateEvent が CalendarApp.createEvent を呼ぶことを確認する（実際の作成は行わない）
 */
function test_onCreateEvent_calls_calendar_createEvent() {
  // stub CalendarApp.createEvent
  _orig.CalendarApp = this.CalendarApp;
  var created = {};
  this.CalendarApp = {
    createEvent: function(title, startTime, endTime, options) {
      created.title = title;
      created.startTime = startTime;
      created.endTime = endTime;
      created.options = options;
      return { getId: function() { return 'mock'; } };
    }
  };

  // stub buildCard to capture status message
  _orig.buildCard = this.buildCard;
  var capturedCard = {};
  this.buildCard = function(values, status) {
    capturedCard.values = values;
    capturedCard.status = status;
    return CardService.newCardBuilder().build(); // return real Card object
  };

  var startMs = Date.now();
  var e = {
    commonEventObject: {
      formInputs: {
        title: { stringInputs: { value: ["TEST MEET"] } },
        guests: { stringInputs: { value: ["x@lycorp.co.jp"] } },
        duration: { stringInputs: { value: ["30"] } },
        startTimeMs: { dateInput: { msSinceEpoch: String(startMs) } },
        location: { stringInputs: { value: ["Room A"] } },
        description: { stringInputs: { value: ["desc"] } }
      }
    }
  };

  onCreateEvent(e);

  _assertEquals("TEST MEET", created.title, "title passed to CalendarApp.createEvent");
  _assertEquals("Room A", created.options.location, "location passed in options");
  _assertEquals("desc", created.options.description, "description passed in options");
  // 終了時刻が開始 + 30分 であること
  var expectedEnd = new Date(startMs + 30 * 60 * 1000).getTime();
  _assertEquals(true, Math.abs(created.endTime.getTime() - expectedEnd) < 1000, "endTime should be start + duration");

  // teardown
  this.CalendarApp = _orig.CalendarApp;
  this.buildCard = _orig.buildCard;
}

/**
 * GASUnit で実行する場合はテスト関数を登録するヘルパ
 * （GASUnit は test で始まる関数を自動実行することが多いが、ここで明示的に呼べるようにする）
 */
function runAllHandlerTests() {
  test_onApplyPrompt_parses_prompt();
  test_onGuestInputChange_appends_domain();
  test_onCreateEvent_calls_calendar_createEvent();
  Logger.log("handlers_test: all tests passed");
}