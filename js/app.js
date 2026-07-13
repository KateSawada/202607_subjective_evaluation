(function () {
  "use strict";

  const config = window.EXPERIMENT_CONFIG;
  const state = {
    participantId: makeId("p"),
    stimuli: null,
    assignmentId: null,
    assignmentToken: makeId("lease"),
    expiresAtMs: null,
    profile: null,
    setId: null,
    trials: [],
    trialIndex: -1,
    responses: [],
    playbackIssue: false,
    heard: { A: false, B: false },
    playingSide: null,
    trialPageStartedAt: null,
    trialPageStartedAtMs: null,
    startedAt: null,
    submissionId: null,
  };

  const screens = {
    intro: document.getElementById("screenIntro"),
    profile: document.getElementById("screenProfile"),
    trial: document.getElementById("screenTrial"),
    done: document.getElementById("screenDone"),
  };
  const progressLabel = document.getElementById("progressLabel");
  const progressBar = document.getElementById("progressBar");
  const startButton = document.getElementById("startButton");
  const profileForm = document.getElementById("profileForm");
  const trialForm = document.getElementById("trialForm");
  const nextTrialButton = document.getElementById("nextTrialButton");
  const issueButton = document.getElementById("issueButton");
  const audioA = document.getElementById("audioA");
  const audioB = document.getElementById("audioB");
  const audioABlocked = document.getElementById("audioABlocked");
  const audioBBlocked = document.getElementById("audioBBlocked");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const retrySubmitButton = document.getElementById("retrySubmitButton");

  init();

  async function init() {
    bindEvents();
    enforceDesktop();
    updateProgress();
    try {
      state.stimuli = await fetchStimuli();
    } catch (error) {
      showIntroError("刺激リストを読み込めませんでした。ページを再読み込みしてください。");
      console.error(error);
    }
  }

  function bindEvents() {
    startButton.addEventListener("click", handleConsent);
    profileForm.addEventListener("submit", handleProfileSubmit);
    nextTrialButton.addEventListener("click", handleNextTrial);
    retrySubmitButton.addEventListener("click", retrySubmission);
    issueButton.addEventListener("click", () => {
      state.playbackIssue = true;
      issueButton.textContent = "再生問題を記録済み";
      issueButton.disabled = true;
    });
    audioA.addEventListener("play", () => handleAudioPlay("A"));
    audioB.addEventListener("play", () => handleAudioPlay("B"));
    audioA.addEventListener("pause", () => handleAudioStop("A"));
    audioB.addEventListener("pause", () => handleAudioStop("B"));
    audioA.addEventListener("ended", () => markHeard("A"));
    audioB.addEventListener("ended", () => markHeard("B"));
  }

  function enforceDesktop() {
    if (!config.requireDesktop || !window.matchMedia("(max-width: 959px)").matches) return;
    showIntroError("この実験はパソコン/ノートパソコン上で参加してください。スマートフォンまたはタブレット端末では参加できません。");
  }

  async function fetchStimuli() {
    const response = await fetch(config.stimuliUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load stimuli: " + response.status);
    const value = await response.json();
    if (!Array.isArray(value.sets) || value.sets.length === 0) throw new Error("Stimuli has no sets");
    return value;
  }

  async function handleConsent() {
    if (!state.stimuli) return;
    if (!isGasConfigured()) {
      showIntroError("GAS endpointが未設定です。実験実施者に連絡してください。");
      return;
    }
    showLoading();
    startButton.disabled = true;
    try {
      const result = await postToGas("assign_set", {
        experiment_id: config.experimentId,
        participant_id: state.participantId,
        assignment_token: state.assignmentToken,
        set_ids: state.stimuli.sets.map((set) => set.set_id),
      });
      if (!result.ok) throw new Error(result.error_code || "assignment_failed");
      const assignedSet = state.stimuli.sets.find((set) => set.set_id === result.set_id);
      if (!assignedSet) throw new Error("GAS returned an unknown set_id");
      state.assignmentId = result.assignment_id;
      state.assignmentToken = result.assignment_token;
      state.expiresAtMs = Date.parse(result.expires_at);
      state.setId = result.set_id;
      state.startedAt = new Date().toISOString();
      state.trials = prepareTrials(assignedSet.trials);
      showScreen("profile");
    } catch (error) {
      const message = String(error.message || error) === "no_set_available"
        ? "現在利用可能な実験セットがありません。お手数ですが、実験実施者にお問い合わせください。"
        : "実験セットを割り当てられませんでした。通信環境を確認して再度お試しください。";
      showIntroError(message);
      console.error(error);
    } finally {
      startButton.disabled = false;
      hideLoading();
    }
  }

  function prepareTrials(trials) {
    return shuffleWithCrypto(trials.map((trial) => ({ ...trial }))).map((trial, index) => ({
      ...trial,
      trial_order: index + 1,
      ab_order_seed: makeId("ab"),
      swapped: cryptoRandomBoolean(),
    }));
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    if (expireIfNeeded()) return;
    const data = new FormData(profileForm);
    state.profile = {
      music_major: data.get("music_major"),
      piano_experience: data.get("piano_experience"),
      composition_experience: data.get("composition_experience"),
    };
    showTrial(0);
  }

  function showTrial(index) {
    if (expireIfNeeded()) return;
    state.trialIndex = index;
    state.playbackIssue = false;
    state.heard = { A: false, B: false };
    state.playingSide = null;
    issueButton.textContent = "再生に問題があった";
    issueButton.disabled = false;
    nextTrialButton.disabled = true;
    audioA.pause();
    audioB.pause();
    updateAudioControls();

    const trial = state.trials[index];
    const pair = trial.swapped
      ? { A: trial.sample_2, B: trial.sample_1, method_A: trial.method_2, method_B: trial.method_1 }
      : { A: trial.sample_1, B: trial.sample_2, method_A: trial.method_1, method_B: trial.method_2 };
    trial.rendered = pair;
    document.getElementById("trialMeta").textContent = `${trial.trial_id} / ${trial.length}`;
    document.getElementById("trialTitle").textContent = trial.title || "同じ2曲について，2つの観点から比較してください";
    audioA.src = pair.A;
    audioB.src = pair.B;
    audioA.load();
    audioB.load();
    renderQuestions(trial);
    showScreen("trial");
    state.trialPageStartedAtMs = Date.now();
    state.trialPageStartedAt = new Date().toISOString();
    updateProgress();
  }

  function renderQuestions(trial) {
    trialForm.innerHTML = "";
    trial.questions.forEach((questionKey) => {
      const question = config.questions[questionKey];
      const card = document.createElement("section");
      card.className = "question-card";
      const text = document.createElement("p");
      text.textContent = question.text;
      card.appendChild(text);
      const choices = document.createElement("div");
      choices.className = "choice-grid";
      config.choices.forEach((choice) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = questionKey;
        input.value = String(choice.value);
        input.required = true;
        input.addEventListener("change", updateNextButton);
        label.append(input, document.createTextNode(choice.label));
        choices.appendChild(label);
      });
      card.appendChild(choices);
      trialForm.appendChild(card);
    });
  }

  function markHeard(side) {
    state.heard[side] = true;
    handleAudioStop(side);
    updateNextButton();
  }

  function handleAudioPlay(side) {
    const other = side === "A" ? audioB : audioA;
    if (!other.paused) other.pause();
    state.playingSide = side;
    updateAudioControls();
  }

  function handleAudioStop(side) {
    if (state.playingSide === side) state.playingSide = null;
    updateAudioControls();
  }

  function updateAudioControls() {
    const blockA = state.playingSide === "B";
    const blockB = state.playingSide === "A";
    audioA.controls = !blockA;
    audioB.controls = !blockB;
    audioA.classList.toggle("hidden", blockA);
    audioB.classList.toggle("hidden", blockB);
    audioABlocked.textContent = blockA ? "曲Bを再生中" : "";
    audioBBlocked.textContent = blockB ? "曲Aを再生中" : "";
    audioABlocked.classList.toggle("hidden", !blockA);
    audioBBlocked.classList.toggle("hidden", !blockB);
  }

  function updateNextButton() {
    const trial = state.trials[state.trialIndex];
    const allAnswered = trial.questions.every((key) => trialForm.elements[key].value !== "");
    nextTrialButton.disabled = !(state.heard.A && state.heard.B && allAnswered);
  }

  async function handleNextTrial() {
    if (expireIfNeeded()) return;
    nextTrialButton.disabled = true;
    showLoading();
    await nextFrame();
    recordCurrentTrial();
    if (state.trialIndex + 1 < state.trials.length) {
      showTrial(state.trialIndex + 1);
      hideLoading();
      return;
    }
    try {
      await submitResponses();
    } catch (error) {
      showSubmissionFailure(error);
    } finally {
      hideLoading();
    }
  }

  function recordCurrentTrial() {
    const trial = state.trials[state.trialIndex];
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - state.trialPageStartedAtMs;
    trial.questions.forEach((questionKey) => {
      const value = Number(trialForm.elements[questionKey].value);
      const preference = value < 0 ? "A" : "B";
      state.responses.push({
        experiment_id: config.experimentId,
        participant_id: state.participantId,
        set_id: state.setId,
        assignment_id: state.assignmentId,
        trial_id: trial.trial_id,
        trial_order: trial.trial_order,
        comparison_id: trial.comparison_id,
        sample_pair_id: trial.sample_pair_id,
        length: trial.length,
        question_type: questionKey,
        response_value: value,
        preference,
        preferred_method: preference === "A" ? trial.rendered.method_A : trial.rendered.method_B,
        method_A: trial.rendered.method_A,
        method_B: trial.rendered.method_B,
        sample_A: trial.rendered.A,
        sample_B: trial.rendered.B,
        swapped: trial.swapped,
        ab_order_seed: trial.ab_order_seed,
        playback_issue: state.playbackIssue,
        trial_page_started_at: state.trialPageStartedAt,
        trial_page_duration_ms: durationMs,
        started_at: state.startedAt,
        finished_at: finishedAt,
        user_agent: navigator.userAgent,
        ...state.profile,
      });
    });
  }

  async function submitResponses() {
    if (expireIfNeeded()) return;
    if (!state.submissionId) state.submissionId = makeId("submission");
    const result = await postToGas("submit", {
      experiment_id: config.experimentId,
      participant_id: state.participantId,
      set_id: state.setId,
      assignment_id: state.assignmentId,
      assignment_token: state.assignmentToken,
      submission_id: state.submissionId,
      submitted_at: new Date().toISOString(),
      profile: state.profile,
      responses: state.responses,
    });
    if (!result.ok) {
      if (result.error_code === "lease_expired") {
        resetExpiredExperiment();
        return;
      }
      throw new Error(result.error_code || "submission_failed");
    }
    document.getElementById("doneTitle").textContent = "回答の送信が終わりました";
    document.getElementById("doneMessage").textContent = "実験へのご協力ありがとうございました。このページを閉じてOKです。";
    document.getElementById("submissionStatus").textContent = "回答が保存されたことを確認しました。";
    retrySubmitButton.classList.add("hidden");
    showScreen("done");
    updateProgress();
  }

  function postToGas(action, payload) {
    return new Promise((resolve, reject) => {
      if (!isGasConfigured()) {
        reject(new Error("gas_not_configured"));
        return;
      }
      const nonce = makeId("response");
      const iframe = document.createElement("iframe");
      const frameName = "gas_response_" + nonce.replace(/[^0-9A-Za-z_]/g, "_");
      iframe.name = frameName;
      iframe.hidden = true;
      document.body.appendChild(iframe);
      const form = document.createElement("form");
      form.method = "POST";
      form.action = config.gasEndpoint;
      form.target = frameName;
      form.hidden = true;
      addFormField(form, "action", action);
      addFormField(form, "payload", JSON.stringify({
        ...payload,
        response_nonce: nonce,
        parent_origin: config.parentOrigin,
      }));
      document.body.appendChild(form);
      let timer;

      function cleanup() {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        form.remove();
        iframe.remove();
      }

      function onMessage(event) {
        if (event.source !== iframe.contentWindow) return;
        if (!isAllowedGasResponseOrigin(event.origin)) return;
        const data = event.data;
        if (!data || data.type !== "subjective_evaluation_gas_response" || data.response_nonce !== nonce) return;
        cleanup();
        resolve(data);
      }

      window.addEventListener("message", onMessage);
      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("gas_timeout"));
      }, config.gasTimeoutMs);
      form.submit();
    });
  }

  function addFormField(form, name, value) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  function expireIfNeeded() {
    if (state.expiresAtMs === null || Date.now() < state.expiresAtMs) return false;
    resetExpiredExperiment();
    return true;
  }

  function resetExpiredExperiment() {
    window.alert("割り当ての有効期限が切れました。最初からやり直してください。");
    audioA.pause();
    audioB.pause();
    state.participantId = makeId("p");
    state.assignmentId = null;
    state.assignmentToken = makeId("lease");
    state.expiresAtMs = null;
    state.profile = null;
    state.setId = null;
    state.trials = [];
    state.trialIndex = -1;
    state.responses = [];
    state.submissionId = null;
    state.startedAt = null;
    profileForm.reset();
    showScreen("intro");
    updateProgress();
  }

  function showSubmissionFailure(error) {
    document.getElementById("doneTitle").textContent = "回答を送信できませんでした";
    document.getElementById("doneMessage").textContent = "通信環境を確認し、実験実施者に連絡してください。";
    document.getElementById("submissionStatus").textContent = "回答は保存済みと確認できていません。ページを閉じないでください。";
    retrySubmitButton.classList.remove("hidden");
    showScreen("done");
    console.error(error);
  }

  async function retrySubmission() {
    if (expireIfNeeded()) return;
    showLoading();
    retrySubmitButton.disabled = true;
    try {
      await submitResponses();
    } catch (error) {
      showSubmissionFailure(error);
    } finally {
      retrySubmitButton.disabled = false;
      hideLoading();
    }
  }

  function showIntroError(message) {
    const warning = document.getElementById("resumeWarning");
    warning.textContent = message;
    warning.classList.remove("hidden");
    startButton.disabled = true;
  }

  function isGasConfigured() {
    return Boolean(config.gasEndpoint && !config.gasEndpoint.includes("PASTE_"));
  }

  function isAllowedGasResponseOrigin(origin) {
    if (config.allowedGasResponseOrigins.includes(origin)) return true;
    try {
      const hostname = new URL(origin).hostname;
      return config.allowedGasResponseHostSuffixes.some((suffix) => hostname.endsWith(suffix));
    } catch (_error) {
      return false;
    }
  }

  function showScreen(name) {
    Object.values(screens).forEach((screen) => screen.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function showLoading() { loadingOverlay.classList.remove("hidden"); }
  function hideLoading() { loadingOverlay.classList.add("hidden"); }
  function nextFrame() { return new Promise((resolve) => window.requestAnimationFrame(resolve)); }

  function updateProgress() {
    if (!state.trials.length || state.trialIndex < 0) {
      progressLabel.textContent = "開始前";
      progressBar.style.width = "0%";
      return;
    }
    const current = Math.min(state.trialIndex + 1, state.trials.length);
    progressLabel.textContent = `${current} / ${state.trials.length}`;
    progressBar.style.width = `${Math.round((current / state.trials.length) * 100)}%`;
  }

  function cryptoRandomBoolean() {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] % 2 === 0;
  }

  function shuffleWithCrypto(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const value = new Uint32Array(1);
      window.crypto.getRandomValues(value);
      const target = value[0] % (index + 1);
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  }

  function makeId(prefix) {
    const values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    return `${prefix}_${Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("")}`;
  }
})();
