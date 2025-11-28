// FM_DISS.js
// Interface integrada: cálculo de parciais FM + curva de dissonância sensorial
// Usa p5.js em modo instance e Web Audio API

const fmDissSketch = (p) => {
  // --------- Variáveis do módulo FM ---------
  let carrierHzInput, midiInputFM, harmInput, betaInput, maxElemInput;
  let ratiosArea, ampsArea, calcButtonFM, playButtonFM, infoPFM;
  let freqModeRadio, filterCheckbox;

  let factMemo = [1]; // memoização de fatorial
  let currentParciais = [];
  let lastFc = 0;
  let lastFm = 0;

  let containerFM;

  // --------- Variáveis do módulo DISS ---------
  let midiInputDISS;
  let calcButtonDISS;
  let minRatiosArea, minMidiArea, infoPDISS;

  let alphaArray = [];
  let dissArray = [];
  let minimaIndices = [];

  let fundamentalFreqDISS = 0;
  let baseFreqsGlobal = [];
  let baseAmpsGlobal = [];

  let plotX0 = 60;
  let plotX1;
  let plotY0 = 30;
  let plotY1;

  let containerDISS;

  // --------- Áudio (compartilhado) ---------
  let audioCtx = null;

  // =====================================================
  // SETUP
  // =====================================================
  p.setup = () => {
    containerFM = p.select("#fm-container");
    containerDISS = p.select("#diss-container");

    // Remove canvas padrão; o canvas será criado só para o gráfico de dissonância
    p.noCanvas();

    // ============ UI FM ============
    const titleFM = p.createElement("h2", "Calculadora de Parciais FM");
    titleFM.parent(containerFM);

    const introFM = p.createP(
      "Insira os parâmetros da síntese FM e clique em \"Calcular espectro\". " +
      "As listas podem ser copiadas com Ctrl+C. Depois, use o botão de " +
      "síntese aditiva para ouvir o resultado."
    );
    introFM.parent(containerFM);

    const modeLabel = p.createP("Modo de entrada da frequência da portadora:");
    modeLabel.parent(containerFM);

    freqModeRadio = p.createRadio();
    freqModeRadio.option("hz", "Inserir frequência em Hz");
    freqModeRadio.option("midi", "Inserir nota MIDI");
    freqModeRadio.selected("hz");
    freqModeRadio.style("margin-bottom", "8px");
    freqModeRadio.parent(containerFM);

    carrierHzInput = createLabeledInputFM(
      "Frequência da portadora (Hz): ",
      "261.625565"
    );

    midiInputFM = createLabeledInputFM(
      "Nota MIDI da portadora (ex.: 60): ",
      "60"
    );

    harmInput = createLabeledInputFM(
      "Índice de harmonicidade H (fm/fc): ",
      "2.2673"
    );

    betaInput = createLabeledInputFM(
      "Índice de modulação β: ",
      "5"
    );

    maxElemInput = createLabeledInputFM(
      "Número máximo de elementos nas listas de saída: ",
      "20"
    );

    filterCheckbox = p.createCheckbox(
      "Remover parciais com amplitude < 0.01",
      false
    );
    filterCheckbox.style("margin", "8px 0");
    filterCheckbox.parent(containerFM);

    calcButtonFM = p.createButton("Calcular espectro");
    calcButtonFM.mousePressed(calcularFM);
    calcButtonFM.style("margin", "8px 4px 8px 0");
    calcButtonFM.parent(containerFM);

    playButtonFM = p.createButton("Tocar som (síntese aditiva)");
    playButtonFM.mousePressed(playAdditiveSoundFM);
    playButtonFM.style("margin", "8px 0");
    playButtonFM.parent(containerFM);

    infoPFM = p.createP("");
    infoPFM.style("font-family", "monospace");
    infoPFM.parent(containerFM);

    const ratiosLabel = p.createP("Razões (freq_parcial / freq_portadora):");
    ratiosLabel.parent(containerFM);

    ratiosArea = p.createElement("textarea");
    ratiosArea.attribute("rows", "8");
    ratiosArea.attribute("cols", "50");
    ratiosArea.style("display", "block");
    ratiosArea.style("margin-bottom", "12px");
    ratiosArea.parent(containerFM);

    const ampsLabel = p.createP("Amplitudes absolutas correspondentes (|Jₙ(β)|):");
    ampsLabel.parent(containerFM);

    ampsArea = p.createElement("textarea");
    ampsArea.attribute("rows", "8");
    ampsArea.attribute("cols", "50");
    ampsArea.style("display", "block");
    ampsArea.parent(containerFM);

    // ============ UI DISSONÂNCIA ============
    const titleDISS = p.createElement("h2", "Curva de dissonância sensorial (Sethares)");
    titleDISS.parent(containerDISS);

    const introDISS = p.createP(
      "1) Informe a nota fundamental em MIDI. " +
      "2) Clique em \"Calcular curva de dissonância\" para usar o timbre gerado pelo módulo FM. " +
      "3) Clique no gráfico para ouvir duas notas (fundamental + intervalo)."
    );
    introDISS.parent(containerDISS);

    const canvas = p.createCanvas(800, 400);
    canvas.parent(containerDISS);

    plotX1 = p.width - 30;
    plotY1 = p.height - 60;

    p.textFont("sans-serif");
    p.noSmooth();

    midiInputDISS = createLabeledInputDISS(
      "Nota MIDI fundamental para análise de dissonância:",
      "60"
    );

    calcButtonDISS = p.createButton("Calcular curva de dissonância");
    calcButtonDISS.mousePressed(computeDissonanceCurve);
    calcButtonDISS.style("margin", "8px 0");
    calcButtonDISS.parent(containerDISS);

    infoPDISS = p.createP("");
    infoPDISS.style("font-family", "monospace");
    infoPDISS.parent(containerDISS);

    const minRatiosLabel = p.createP(
      "Razões intervalares dos mínimos locais de dissonância (entre 1 e 2):"
    );
    minRatiosLabel.parent(containerDISS);

    minRatiosArea = p.createElement("textarea");
    minRatiosArea.attribute("rows", "4");
    minRatiosArea.attribute("cols", "40");
    minRatiosArea.style("display", "block");
    minRatiosArea.parent(containerDISS);

    const minMidiLabel = p.createP(
      "Notas MIDI (microtonais) correspondentes aos mínimos locais:"
    );
    minMidiLabel.parent(containerDISS);

    minMidiArea = p.createElement("textarea");
    minMidiArea.attribute("rows", "4");
    minMidiArea.attribute("cols", "40");
    minMidiArea.style("display", "block");
    minMidiArea.parent(containerDISS);
  };

  // =====================================================
  // DRAW
  // =====================================================
  p.draw = () => {
    p.background(250);

    drawAxes();

    if (alphaArray.length > 0 && dissArray.length === alphaArray.length) {
      drawCurve();
      drawMinimaPoints();
      drawHoverTooltip();
    }
  };

  // =====================================================
  // Helpers de interface
  // =====================================================
  function createLabeledInputFM(labelText, defaultValue) {
    const div = p.createDiv();
    div.style("margin", "4px 0");
    div.parent(containerFM);

    const label = p.createSpan(labelText);
    label.parent(div);

    const inp = p.createInput(defaultValue, "number");
    inp.parent(div);
    inp.style("margin-left", "4px");
    inp.style("width", "120px");

    return inp;
  }

  function createLabeledInputDISS(labelText, defaultValue) {
    const div = p.createDiv();
    div.style("margin", "4px 0");
    div.parent(containerDISS);

    const label = p.createSpan(labelText);
    label.parent(div);

    const inp = p.createInput(defaultValue, "number");
    inp.parent(div);
    inp.style("margin-left", "4px");
    inp.style("width", "120px");

    return inp;
  }

  // =====================================================
  // MÓDULO FM
  // =====================================================

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function calcularFM() {
    const mode = freqModeRadio.value();
    let fc;

    if (mode === "hz") {
      const fcHz = parseFloat(carrierHzInput.value());
      if (!isFinite(fcHz) || fcHz <= 0) {
        infoPFM.html("Frequência em Hz inválida.");
        ratiosArea.value("");
        ampsArea.value("");
        currentParciais = [];
        return;
      }
      fc = fcHz;
    } else {
      const midiVal = parseFloat(midiInputFM.value());
      if (!isFinite(midiVal)) {
        infoPFM.html("Nota MIDI inválida.");
        ratiosArea.value("");
        ampsArea.value("");
        currentParciais = [];
        return;
      }
      fc = midiToFreq(midiVal);
    }

    const H = parseFloat(harmInput.value());
    const beta = parseFloat(betaInput.value());
    const maxElems = parseInt(maxElemInput.value(), 10);

    if (!isFinite(H) || !isFinite(beta) || !isFinite(maxElems) || maxElems <= 0) {
      infoPFM.html("Parâmetros inválidos. Verifique H, β e o número máximo.");
      ratiosArea.value("");
      ampsArea.value("");
      currentParciais = [];
      return;
    }

    const fm = H * fc;
    const N_internal = 50;

    let parciais = [];

    for (let n = -N_internal; n <= N_internal; n++) {
      const fn = fc + n * fm;
      const freqPos = Math.abs(fn);
      const amp = Math.abs(besselJ(n, beta));

      parciais.push({
        n: n,
        freq: freqPos,
        ratio: freqPos / fc,
        amp: amp
      });
    }

    if (filterCheckbox.checked()) {
      parciais = parciais.filter(p0 => p0.amp >= 0.01);
    }

    parciais.sort((a, b) => a.ratio - b.ratio);

    if (parciais.length > maxElems) {
      parciais = parciais.slice(0, maxElems);
    }

    currentParciais = parciais;
    lastFc = fc;
    lastFm = fm;

    const ratios = parciais.map(p0 => p0.ratio);
    const amps = parciais.map(p0 => p0.amp);

    ratiosArea.value(formatArrayTruncated(ratios, 2));
    ampsArea.value(formatArrayTruncated(amps, 2));

    infoPFM.html(
      "fc = " + fc.toFixed(4) + " Hz,  fm = " + fm.toFixed(4) + " Hz, " +
      "parciais listados = " + parciais.length
    );

    resetDissonanceData();
  }

  function playAdditiveSoundFM() {
    if (!currentParciais || currentParciais.length === 0) {
      infoPFM.html("Calcule o espectro antes de tocar o som.");
      return;
    }

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (e) {
      infoPFM.html("Seu navegador não suporta Web Audio API.");
      return;
    }

    const duration = 2.0;
    const now = audioCtx.currentTime;

    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    let totalAmp = 0;
    currentParciais.forEach(p0 => {
      totalAmp += p0.amp;
    });

    if (totalAmp <= 0) {
      masterGain.gain.setValueAtTime(0, now);
      infoPFM.html("Sem amplitude suficiente para síntese.");
      return;
    }

    const scale = 0.7 / totalAmp;

    masterGain.gain.setValueAtTime(1.0, now);
    masterGain.gain.setTargetAtTime(0.0, now + duration * 0.8, 0.2);

    currentParciais.forEach(p0 => {
      const freq = p0.freq;

      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(p0.amp * scale, now);

      osc.connect(g);
      g.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration);
    });

    infoPFM.html(
      "Tocando som aditivo: fc = " + lastFc.toFixed(2) +
      " Hz, parciais usados = " + currentParciais.length
    );
  }

  function factorial(n) {
    if (n < 0) return NaN;
    if (factMemo[n] !== undefined) return factMemo[n];

    let lastIndex = factMemo.length - 1;
    let res = factMemo[lastIndex];

    for (let i = lastIndex + 1; i <= n; i++) {
      res *= i;
      factMemo[i] = res;
    }
    return factMemo[n];
  }

  function besselJ(n, x) {
    let sign = 1;
    if (n < 0) {
      const k = -n;
      sign = (k % 2 === 0) ? 1 : -1;
      n = k;
    }

    const maxM = 50;
    const x2 = x / 2.0;
    let sum = 0;

    for (let m = 0; m < maxM; m++) {
      const num = Math.pow(-1, m) * Math.pow(x2, 2 * m + n);
      const denom = factorial(m) * factorial(m + n);
      const term = num / denom;
      sum += term;
      if (Math.abs(term) < 1e-15) break;
    }

    return sign * sum;
  }

  function truncateToDecimals(x, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.trunc(x * factor) / factor;
  }

  function formatArrayTruncated(arr, decimals) {
    if (!arr || arr.length === 0) return "[]";
    return "[" + arr
      .map(x => truncateToDecimals(x, decimals).toFixed(decimals))
      .join(", ") + "]";
  }

  // =====================================================
  // MÓDULO DISSONÂNCIA SENSORIAL
  // =====================================================

  function freqToMidi(freq) {
    return 69 + 12 * (Math.log(freq / 440) / Math.log(2));
  }

  function resetDissonanceData() {
    alphaArray = [];
    dissArray = [];
    minimaIndices = [];
    baseFreqsGlobal = [];
    baseAmpsGlobal = [];
    if (minRatiosArea) minRatiosArea.value("");
    if (minMidiArea) minMidiArea.value("");
  }

  function parseNumberList(str) {
    if (!str) return [];
    const cleaned = str.replace(/[\[\]]/g, " ");
    const tokens = cleaned.split(/[\s,]+/);
    const nums = [];
    for (let t of tokens) {
      if (!t) continue;
      const v = parseFloat(t);
      if (isFinite(v)) nums.push(v);
    }
    return nums;
  }

  function computeDissonanceCurve() {
    const midiVal = parseFloat(midiInputDISS.value());
    if (!isFinite(midiVal)) {
      infoPDISS.html("Nota MIDI inválida.");
      resetDissonanceData();
      return;
    }
    fundamentalFreqDISS = midiToFreq(midiVal);

    const ratios = parseNumberList(ratiosArea.value());
    const amps = parseNumberList(ampsArea.value());

    if (ratios.length === 0 || amps.length === 0) {
      infoPDISS.html("Listas de razões e amplitudes vazias ou inválidas. Calcule o espectro FM ou ajuste as listas.");
      resetDissonanceData();
      return;
    }
    if (ratios.length !== amps.length) {
      infoPDISS.html("As listas de razões e amplitudes devem ter o MESMO tamanho.");
      resetDissonanceData();
      return;
    }

    baseFreqsGlobal = ratios.map(r => fundamentalFreqDISS * r);
    baseAmpsGlobal = amps.slice();

    const rLow = 1.0;
    const rHigh = 2.0;
    const nPoints = 600;

    alphaArray = [];
    dissArray = [];

    for (let i = 0; i < nPoints; i++) {
      const alpha = p.map(i, 0, nPoints - 1, rLow, rHigh);

      const freq2 = baseFreqsGlobal.map(f => alpha * f);
      const fvec = baseFreqsGlobal.concat(freq2);
      const avec = baseAmpsGlobal.concat(baseAmpsGlobal);

      const d = dissMeasureSethares(fvec, avec);

      alphaArray.push(alpha);
      dissArray.push(d);
    }

    minimaIndices = [];
    for (let i = 1; i < dissArray.length - 1; i++) {
      if (dissArray[i] < dissArray[i - 1] && dissArray[i] < dissArray[i + 1]) {
        minimaIndices.push(i);
      }
    }

    const minRatios = [];
    const minMidis = [];

    for (let idx of minimaIndices) {
      const alpha = alphaArray[idx];
      const freq = fundamentalFreqDISS * alpha;
      const midiNote = freqToMidi(freq);

      minRatios.push(alpha);
      minMidis.push(midiNote);
    }

    minRatiosArea.value(formatArray(minRatios, 4));
    minMidiArea.value(formatArray(minMidis, 4));

    infoPDISS.html(
      "Curva calculada com " + alphaArray.length +
      " pontos. Mínimos locais encontrados: " + minimaIndices.length + ". " +
      "Clique no gráfico para ouvir duas notas (fundamental + intervalo)."
    );
  }

  function formatArray(arr, decimals) {
    if (arr.length === 0) return "[]";
    return "[" +
      arr.map(x => x.toFixed(decimals)).join(", ") +
      "]";
  }

  function dissMeasureSethares(freqArray, ampArray) {
    const idx = [...freqArray.keys()].sort((i, j) => freqArray[i] - freqArray[j]);
    const fr = idx.map(i => freqArray[i]);
    const am = idx.map(i => ampArray[i]);

    const Dstar = 0.24;
    const S1 = 0.0207;
    const S2 = 18.96;
    const C1 = 5.0;
    const C2 = -5.0;
    const A1 = -3.51;
    const A2 = -5.75;

    let D = 0.0;
    const n = fr.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const f1 = fr[i];
        const f2 = fr[j];
        const a1 = am[i];
        const a2 = am[j];

        const Fmin = Math.min(f1, f2);
        const Fdif = Math.abs(f2 - f1);
        const S = Dstar / (S1 * Fmin + S2);
        const a = Math.min(a1, a2);

        const x = S * Fdif;
        const term = a * (C1 * Math.exp(A1 * x) + C2 * Math.exp(A2 * x));

        D += term;
      }
    }
    return D;
  }

  // =====================================================
  // DESENHO DO GRÁFICO
  // =====================================================

  function drawAxes() {
    p.stroke(0);
    p.strokeWeight(1);

    p.line(plotX0, plotY1, p.width - 20, plotY1);
    p.line(plotX0, plotY1, plotX0, plotY0);

    // X: 1.0 a 2.0 passo 0.1
    p.textSize(11);
    for (let r = 1.0; r <= 2.0001; r += 0.1) {
      const x = p.map(r, 1, 2, plotX0, plotX1);
      p.stroke(200);
      p.line(x, plotY1, x, plotY1 - 5);
      p.noStroke();
      p.fill(0);
      p.textAlign(p.CENTER, p.TOP);
      p.text(r.toFixed(1), x, plotY1 + 5);
    }

    // Título eixo X (mais baixo)
    p.noStroke();
    p.fill(0);
    p.textSize(12);
    p.textAlign(p.CENTER, p.TOP);
    p.text("Razão de frequências (intervalo)", (plotX0 + plotX1) / 2, plotY1 + 28);

    // Título eixo Y
    p.push();
    p.translate(20, (plotY0 + plotY1) / 2);
    p.rotate(-p.HALF_PI);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("Dissonância sensorial (relativa)", 0, 0);
    p.pop();

    // Y: passos de 0.1 até o máximo
    if (dissArray.length > 0) {
      const dMin = Math.min(...dissArray);
      const dMax = Math.max(...dissArray);
      const maxTick = Math.ceil(dMax * 10) / 10;
      const minTick = 0.0;

      p.textSize(11);
      p.textAlign(p.RIGHT, p.CENTER);

      for (let v = minTick; v <= maxTick + 1e-6; v += 0.1) {
        const y = p.map(v, dMin, dMax, plotY1, plotY0);
        if (y < plotY0 || y > plotY1) continue;

        p.stroke(230);
        p.line(plotX0, y, plotX1, y);

        p.noStroke();
        p.fill(0);
        p.text(v.toFixed(1), plotX0 - 8, y);
      }
    }
  }

  function drawCurve() {
    if (dissArray.length < 2) return;

    const dMin = Math.min(...dissArray);
    const dMax = Math.max(...dissArray);

    p.stroke(50, 80, 200);
    p.strokeWeight(1.5);
    p.noFill();

    p.beginShape();
    for (let i = 0; i < alphaArray.length; i++) {
      const x = p.map(alphaArray[i], 1, 2, plotX0, plotX1);
      const y = p.map(dissArray[i], dMin, dMax, plotY1, plotY0);
      p.vertex(x, y);
    }
    p.endShape();
  }

  function drawMinimaPoints() {
    if (!minimaIndices || minimaIndices.length === 0) return;

    const dMin = Math.min(...dissArray);
    const dMax = Math.max(...dissArray);

    p.noStroke();
    p.fill(255, 140, 0);
    for (let idx of minimaIndices) {
      const alpha = alphaArray[idx];
      const d = dissArray[idx];
      const x = p.map(alpha, 1, 2, plotX0, plotX1);
      const y = p.map(d, dMin, dMax, plotY1, plotY0);
      p.ellipse(x, y, 8, 8);
    }
  }

  function drawHoverTooltip() {
    if (alphaArray.length === 0) return;

    if (p.mouseX < plotX0 || p.mouseX > plotX1 || p.mouseY < plotY0 || p.mouseY > plotY1) return;

    const t = p.constrain((p.mouseX - plotX0) / (plotX1 - plotX0), 0, 1);
    const idx = Math.floor(t * (alphaArray.length - 1));
    const alpha = alphaArray[idx];

    const dMin = Math.min(...dissArray);
    const dMax = Math.max(...dissArray);
    const d = dissArray[idx];

    const x = p.map(alpha, 1, 2, plotX0, plotX1);
    const y = p.map(d, dMin, dMax, plotY1, plotY0);

    p.stroke(0);
    p.fill(255);
    p.ellipse(x, y, 10, 10);

    const ratioText = "Razão: " + alpha.toFixed(4);
    const dissText = "Dissonância: " + d.toFixed(3);
    const freq = fundamentalFreqDISS * alpha;
    const midiVal = freqToMidi(freq);
    const midiText = "MIDI: " + midiVal.toFixed(2);

    const tw = Math.max(
      p.textWidth(ratioText),
      p.textWidth(dissText),
      p.textWidth(midiText)
    ) + 10;
    const th = 44;

    let bx = x + 10;
    let by = y - th - 10;
    if (bx + tw > p.width) bx = p.width - tw - 10;
    if (by < 10) by = y + 10;

    p.noStroke();
    p.fill(255, 245);
    p.rect(bx, by, tw, th);

    p.fill(0);
    p.textAlign(p.LEFT, p.TOP);
    p.text(ratioText, bx + 5, by + 3);
    p.text(dissText, bx + 5, by + 15);
    p.text(midiText, bx + 5, by + 27);
  }

  // =====================================================
  // Clique para playback da dissonância
  // =====================================================
  p.mousePressed = () => {
    if (alphaArray.length === 0) return;
    if (p.mouseX < plotX0 || p.mouseX > plotX1 || p.mouseY < plotY0 || p.mouseY > plotY1) return;
    if (baseFreqsGlobal.length === 0 || baseAmpsGlobal.length === 0) return;

    const t = p.constrain((p.mouseX - plotX0) / (plotX1 - plotX0), 0, 1);
    const idx = Math.floor(t * (alphaArray.length - 1));
    const alpha = alphaArray[idx];

    playTwoToneAdditive(alpha);
  };

  function playTwoToneAdditive(alpha) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (e) {
      infoPDISS.html("Seu navegador não suporta Web Audio API.");
      return;
    }

    const duration = 1.2;
    const now = audioCtx.currentTime;

    const masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);

    let totalAmp = 0;
    baseAmpsGlobal.forEach(a => totalAmp += a);
    const totalAmpAll = totalAmp * 2;

    if (totalAmpAll <= 0) {
      masterGain.gain.setValueAtTime(0, now);
      return;
    }

    const scale = 0.7 / totalAmpAll;

    masterGain.gain.setValueAtTime(1.0, now);
    masterGain.gain.setTargetAtTime(0.0, now + duration * 0.7, 0.25);

    // Nota 1
    baseFreqsGlobal.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(baseAmpsGlobal[i] * scale, now);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + duration);
    });

    // Nota 2
    baseFreqsGlobal.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f * alpha, now);
      g.gain.setValueAtTime(baseAmpsGlobal[i] * scale, now);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + duration);
    });

    infoPDISS.html(
      "Reproduzindo duas notas: fundamental = " +
      fundamentalFreqDISS.toFixed(2) + " Hz, intervalo razão = " +
      alpha.toFixed(4)
    );
  }
};

new p5(fmDissSketch);
