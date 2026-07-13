window.EXPERIMENT_CONFIG = {
  experimentId: "202607_subjective_evaluation",
  gasEndpoint: "PASTE_GAS_WEB_APP_URL_HERE",
  stimuliUrl: "data/stimuli.example.json",
  driveRootFolderId: "1a8NatenMw3nw_0_ka1VBep6wKgh3U7yy",
  parentOrigin: window.location.origin,
  allowedGasResponseOrigins: [
    "https://script.google.com",
    "https://script.googleusercontent.com",
  ],
  allowedGasResponseHostSuffixes: [".googleusercontent.com"],
  gasTimeoutMs: 15000,
  requireDesktop: true,
  choices: [
    { value: -2, label: "Aの方が明らかによい" },
    { value: -1, label: "Aの方がややよい" },
    { value: 1, label: "Bの方がややよい" },
    { value: 2, label: "Bの方が明らかによい" },
  ],
  questions: {
    global_structure: {
      label: "全体構成のまとまり",
      text: "どちらの楽曲の方が，32小節全体として反復・展開・セクションのまとまりを感じますか？",
    },
    local_naturalness: {
      label: "局所的な自然さ",
      text: "どちらの楽曲の方が，1〜2小節程度の短い範囲で音高・リズム・和音の流れが自然に聞こえますか？",
    },
  },
};
