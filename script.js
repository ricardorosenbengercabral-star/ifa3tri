(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
};
const fmt = (n,d=1) => n.toFixed(d).replace('.',',');

/* ---------- Menu ---------- */
const btnMenu = $('#btnMenu'), menu = $('#menu');
btnMenu.addEventListener('click', () => {
  const abre = menu.classList.toggle('aberto');
  btnMenu.setAttribute('aria-expanded', abre);
});
menu.addEventListener('click', e => { if (e.target.tagName === 'A') { menu.classList.remove('aberto'); btnMenu.setAttribute('aria-expanded', false); } });

/* ---------- Acessibilidade ---------- */
let tam = parseInt(store.get('tam') || '100', 10);
const aplicaTam = () => { document.documentElement.style.setProperty('--fs', tam + '%'); store.set('tam', tam); };
const alterna = (classe, btn) => {
  const on = document.body.classList.toggle(classe);
  btn.setAttribute('aria-pressed', on); store.set(classe, on ? '1' : '0');
  redesenha();
};
$$('.barra-acess button').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.acao;
  if (a === 'contraste' || a === 'dislexia' || a === 'calmo') alterna(a, b);
  if (a === 'mais') { tam = Math.min(160, tam + 10); aplicaTam(); }
  if (a === 'menos') { tam = Math.max(80, tam - 10); aplicaTam(); }
  if (a === 'zerar') {
    tam = 100; aplicaTam();
    ['contraste','dislexia','calmo'].forEach(c => { document.body.classList.remove(c); store.set(c,'0'); });
    $$('.barra-acess [aria-pressed]').forEach(x => x.setAttribute('aria-pressed','false'));
    redesenha();
  }
}));
['contraste','dislexia','calmo'].forEach(c => {
  if (store.get(c) === '1') { document.body.classList.add(c); $(`[data-acao=${c}]`).setAttribute('aria-pressed','true'); }
});
aplicaTam();

/* ---------- Pontos de medição ---------- */
const pontos = [
  'Superfície: recebe sol e perde calor para o ar. Costuma ser a mais quente de dia e a que mais oscila.',
  'Fundo: mais fria e estável. A diferença entre fundo e superfície mostra a estratificação (a água não está misturada).',
  'Entrada do coletor: água que sai da piscina e vai ao coletor. Serve de referência para saber quanto calor foi ganho.',
  'Saída do coletor: água já aquecida. A diferença entre as sondas 4 e 3 indica o ganho de calor do coletor.',
  'Placa do coletor: a temperatura mais alta do sistema. Se ela passa a da piscina em mais de 5 °C, a bomba liga.'
];
$$('.ponto').forEach(p => p.addEventListener('click', () => {
  $$('.ponto').forEach(x => x.setAttribute('aria-pressed','false'));
  p.setAttribute('aria-pressed','true');
  $('#infoPonto').textContent = `Sensor ${+p.dataset.i + 1}. ${pontos[p.dataset.i]}`;
}));

/* ---------- Gráfico simples em canvas ---------- */
function plot(c, series, o = {}) {
  const x = c.getContext('2d'), W = c.width, H = c.height, m = { l: 48, r: 14, t: 14, b: 30 };
  const cs = getComputedStyle(document.body);
  const ink = cs.getPropertyValue('--ink').trim(), line = cs.getPropertyValue('--line').trim();
  const alto = document.body.classList.contains('contraste');
  const corAgua = alto ? '#00FFFF' : '#0A6C9E', corSol = alto ? '#FFE600' : '#FB8500';
  x.clearRect(0, 0, W, H); x.font = '13px sans-serif'; x.lineWidth = 1;
  let xs = [], ys = [];
  series.forEach(s => s.d.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys) - .3, y1 = Math.max(...ys) + .3;
  const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  x.fillStyle = ink; x.strokeStyle = line;
  for (let i = 0; i <= 4; i++) {
    const v = y0 + (y1 - y0) * i / 4, y = Y(v);
    x.beginPath(); x.moveTo(m.l, y); x.lineTo(W - m.r, y); x.stroke(); x.fillText(v.toFixed(1), 6, y + 4);
    const t = x0 + (x1 - x0) * i / 4; x.fillText(t.toFixed(o.dx || 0), X(t) - 8, H - 10);
  }
  series.forEach(s => {
    x.fillStyle = x.strokeStyle = s.sol ? corSol : corAgua;
    if (s.pts) s.d.forEach(p => { x.beginPath(); x.arc(X(p[0]), Y(p[1]), 2.6, 0, 7); x.fill(); });
    else { x.lineWidth = 3; x.beginPath(); s.d.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.stroke(); }
  });
  if (o.marca != null) { x.strokeStyle = ink; x.setLineDash([6, 5]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(X(o.marca), m.t); x.lineTo(X(o.marca), H - m.b); x.stroke(); x.setLineDash([]); }
}
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ruido = a => (rnd() * 2 - 1) * a;

/* ---------- Simulador 1: sinal elétrico ---------- */
const B = 3950, R0 = 10000, T0 = 298.15, RF = 10000;
function sim1() {
  const t = +$('#inT').value; $('#oT').textContent = fmt(t);
  const R = R0 * Math.exp(B * (1 / (t + 273.15) - 1 / T0));
  const V = 5 * RF / (RF + R), adc = Math.round(V / 5 * 1023);
  const Rn = RF * (1023 / adc - 1), Tc = 1 / (1 / T0 + Math.log(Rn / R0) / B) - 273.15;
  const vl = .01 * t, al = Math.round(vl / 5 * 1023);
  $('#rR').textContent = R >= 1000 ? fmt(R / 1000, 2) + ' kΩ' : fmt(R, 0) + ' Ω';
  $('#rV').textContent = fmt(V, 2) + ' V';
  $('#rA').textContent = adc;
  $('#rC').textContent = fmt(Tc, 1) + ' °C';
  $('#rL').textContent = fmt(vl * 1000, 0) + ' mV, ADC ' + al;
}

/* ---------- Simulador 2: resposta, resolução, precisão ---------- */
function sim2() {
  const tau = +$('#inTau').value, res = +$('#inRes').value, ru = +$('#inRu').value;
  $('#oTau').textContent = tau; $('#oRu').textContent = fmt(ru);
  seed = 7; const real = [], leit = [];
  for (let t = 0; t <= 300; t += 2) {
    const agua = t < 10 ? 25 : 45, s = t < 10 ? 25 : 45 - 20 * Math.exp(-(t - 10) / tau);
    real.push([t, agua]); leit.push([t, Math.round((s + ruido(ru)) / res) * res]);
  }
  plot($('#cResp'), [{ d: real }, { d: leit, pts: true, sol: true }], { dx: 0 });
  $('#txtResp').textContent = `Com τ = ${tau} s o sensor chega a 90% da variação em cerca de ${fmt(2.3 * tau, 0)} s. Resolução de ${fmt(res, res < .1 ? 4 : 1)} °C e ruído de ±${fmt(ru)} °C. ` +
    (tau > 60 ? 'Sonda lenta: o dado chega atrasado e a automação reage tarde.' : 'Sonda rápida: boa para acompanhar mudanças.');
}

/* ---------- Simulador 3: piscina em 24 h ---------- */
function sim3() {
  const G = +$('#inG').value, A = +$('#inA').value, V = +$('#inV').value, Ta = +$('#inTa').value, H = +$('#inH').value;
  $('#oG').textContent = G; $('#oA').textContent = A; $('#oV').textContent = V; $('#oTa').textContent = Ta; $('#oH').textContent = H;
  seed = 11; let T = Ta + 2; const real = [], leit = [], C = V * 1000 * 4186;
  for (let i = 0; i <= 1440; i++) {
    const h = i / 60, g = G * Math.max(0, Math.sin(Math.PI * (h - 6) / 12));
    if (i) T += (g * A * 0.6 - 40 * (T - Ta)) * 60 / C;
    real.push([h, T]); leit.push([h, Math.round((T + ruido(.1)) / .1) * .1]);
  }
  const k = Math.round(H * 60), med = (a, b) => leit.slice(a, b).reduce((s, p) => s + p[1], 0) / (b - a);
  const dif = med(k - 60, k) - med(k - 120, k - 60);
  plot($('#cPisc'), [{ d: real }, { d: leit.filter((_, i) => i % 10 === 0), pts: true, sol: true }], { dx: 0, marca: H });
  const ganho = real[1440][1] - real[0][1];
  $('#txtPisc').textContent = `Às ${H} h a média da última hora ficou ${fmt(Math.abs(dif), 2)} °C ${dif >= 0 ? 'acima' : 'abaixo'} da hora anterior. ` +
    (dif > 0.05 ? 'Resultado: AQUECENDO (acima do ruído do sensor). ' : dif < -0.05 ? 'Resultado: ESFRIANDO. ' : 'Resultado: ESTÁVEL ou dentro do ruído. ') +
    `Em 24 h a água variou ${fmt(ganho, 1)} °C.`;
  $('#heroTemp').textContent = fmt(real[Math.min(k, 1440)][1]);
}

const redesenha = () => { sim2(); sim3(); };
['#inT'].forEach(s => $(s).addEventListener('input', sim1));
['#inTau', '#inRes', '#inRu'].forEach(s => $(s).addEventListener('input', sim2));
['#inG', '#inA', '#inV', '#inTa', '#inH'].forEach(s => $(s).addEventListener('input', sim3));
sim1(); redesenha();

/* ---------- Vídeos ---------- */
// Os vídeos do projeto agora estão no Google Drive e aparecem direto no index.html (iframes).
// Esta lista é só para vídeos locais da pasta "videos". Está vazia de propósito.
// Para adicionar um vídeo local, use o nome do arquivo SEM a extensão. Exemplo:
//   { nome: 'montagem', titulo: 'Montagem do circuito' }
const VIDEOS = [];
// O navegador tenta cada formato na ordem até achar um que exista e toque.
const EXTS = [['mp4','video/mp4'],['MP4','video/mp4'],['webm','video/webm'],['mov','video/mp4'],['MOV','video/mp4']];
const lista = $('#listaVideos');
VIDEOS.forEach(v => {
  const fig = document.createElement('figure'); fig.className = 'vid';
  const vid = document.createElement('video');
  vid.controls = true; vid.preload = 'metadata'; vid.setAttribute('playsinline','');
  const aviso = document.createElement('p'); aviso.className = 'aviso'; aviso.hidden = true; aviso.setAttribute('role','alert');
  EXTS.forEach(([e,t],n) => {
    const s = document.createElement('source'); s.src = `videos/${v.nome}.${e}`; s.type = t;
    if (n === EXTS.length - 1) s.addEventListener('error', () => {
      aviso.hidden = false;
      aviso.textContent = `Vídeo não encontrado. Confira se existe videos/${v.nome}.mp4 no repositório (pasta "videos" ao lado do index.html, nome em minúsculas) e se o vídeo está em MP4 H.264.`;
    });
    vid.appendChild(s);
  });
  vid.addEventListener('loadedmetadata', () => {
    if (!vid.videoWidth) { aviso.hidden = false; aviso.textContent = 'O arquivo foi encontrado, mas a imagem não toca neste navegador (provavelmente formato H.265/HEVC). Converta para MP4 H.264.'; }
    else aviso.hidden = true;
  });
  const cap = document.createElement('figcaption'); cap.textContent = v.titulo;
  fig.append(vid, aviso, cap); lista.appendChild(fig);
});
})();
