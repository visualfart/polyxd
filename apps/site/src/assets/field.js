// polyxd.com: the dot field. Every canvas[data-field] on a page gets one: ink dots, as a Riso
// print is made, that drift, swell and change colour under the pointer. The field reads the
// words laid over it, glyph by glyph: each word is drawn into a soft mask in its own font at its
// own place, and the dots thin out right at the letters' edges, so type sits on clear ground
// without a box behind it. Near the pointer the dots trace the letters' outlines.
// The home page's hero also gathers the dots into a screen (window.PolyxdField.get(canvas)).
//
//   data-rest, data-rest-alpha   the dots at rest (default: the page's ink at 20%)
//   data-active                  the dots under the pointer (default: signal orange)
//   data-density                 how much of the field is inked (default 1)
//   data-quiet                   selector: text the dots flow around, letter by letter
//   data-solid                   selector: shapes the dots keep clear of (controls, marks)
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fields = new Map();
  window.PolyxdField = { get: (el) => fields.get(el) };
  const rgb = (v) => {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = v;
    const h = c.fillStyle;
    return h.startsWith("#") ? [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) : h.match(/[\d.]+/g).slice(0, 3).map((n) => n / 255);
  };
  const token = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  const FS = `precision highp float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform float F; uniform vec4 B; uniform float D;
uniform vec3 REST; uniform vec3 ACT; uniform float RA; uniform float DEN; uniform sampler2D TX; uniform vec2 TS;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
float box(vec2 p, vec4 r){vec2 c=r.xy+r.zw*.5;vec2 d=abs(p-c)-r.zw*.5;return length(max(d,0.))+min(max(d.x,d.y),0.);}
void main(){
  vec2 px=vec2(gl_FragCoord.x,R.y-gl_FragCoord.y)/D; vec2 res=R/D;
  float cell=11.; vec2 g=floor(px/cell)*cell+cell*.5; vec2 q=g/max(res.y,600.);
  vec2 w=vec2(fbm(q*2.2+vec2(T*.03,0.)),fbm(q*2.2+vec2(0.,-T*.025)+4.1));
  float flow=fbm(q*3.1+w*1.6+vec2(T*.02,-T*.015));
  vec2 dm=g-M; float pull=exp(-dot(dm,dm)/(2.*150.*150.));
  float sd=box(g,B); float inside=1.-smoothstep(-4.,4.,sd); float halo=exp(-max(sd,0.)/38.)*(1.-inside);
  // The letters: m is 1 on a glyph and falls to 0 a few pixels outside it.
  float m=texture2D(TX,g/TS).a;
  // Only a dot that would touch a stroke goes; the rest of the field runs right up to the words.
  float clear=1.-smoothstep(.2,.5,m);
  float outline=smoothstep(.03,.12,m)*(1.-smoothstep(.22,.5,m));
  float trace=outline*pull;
  float dens=smoothstep(.42,.86,flow)*.95*DEN+pull*.85*clear+trace*1.4;
  float condensed=max(inside*.92,halo*.9*(.6+.4*sin(T*3.+sd*.08)));
  dens=mix(dens,max(dens*.18,condensed),F)*max(clear,trace);
  float rad=cell*.5*clamp(dens,0.,1.);
  float dotm=1.-smoothstep(rad-.7,rad+.7,length(px-g));
  float warm=clamp(pull*1.25*clear+trace*1.6+(inside+halo)*F,0.,1.);
  vec3 col=mix(REST,ACT,warm); float a=dotm*mix(RA,1.,warm);
  gl_FragColor=vec4(col*a,a);
}`;

  /** Draws every word of `el` into ctx (client coordinates), in its own font, where the browser laid it out. */
  function drawText(ctx, el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue;
      if (!text || !text.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest("[hidden], .sr-only")) continue;
      const st = getComputedStyle(parent);
      if (st.visibility === "hidden" || st.display === "none") continue;
      ctx.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const upper = st.textTransform === "uppercase";
      const re = /\S+/g;
      for (let mt = re.exec(text); mt; mt = re.exec(text)) {
        range.setStart(node, mt.index);
        range.setEnd(node, mt.index + mt[0].length);
        const r = range.getBoundingClientRect();
        if (r.width < 1) continue;
        const word = upper ? mt[0].toUpperCase() : mt[0];
        const me = ctx.measureText(word);
        const asc = me.fontBoundingBoxAscent ?? me.actualBoundingBoxAscent, desc = me.fontBoundingBoxDescent ?? me.actualBoundingBoxDescent;
        const y = r.top + (r.height - (asc + desc)) / 2 + asc;
        ctx.save();
        ctx.translate(r.left, y);
        ctx.scale(r.width / (me.width || r.width), 1);
        if (ctx.lineWidth > 0) ctx.strokeText(word, 0, 0);
        ctx.fillText(word, 0, 0);
        ctx.restore();
      }
    }
  }

  function init(canvas) {
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: true, alpha: true });
    if (!gl) return;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    canvas.classList.add("field-live");
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const lp = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(lp);
    gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(["R", "T", "M", "F", "B", "D", "REST", "ACT", "RA", "DEN", "TX", "TS"].map((k) => [k, gl.getUniformLocation(pr, k)]));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // The letters' mask, drawn at half resolution and softened, as a texture.
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, 1, 1, 0, gl.ALPHA, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    const SCALE = .5;
    const sharp = document.createElement("canvas"), soft = document.createElement("canvas");
    const sctx = sharp.getContext("2d"), fctx = soft.getContext("2d");
    const blur = "filter" in fctx;
    let size = [1, 1];

    const ds = canvas.dataset;
    // Colours follow the theme: read again when the switch or the system changes it.
    let REST, ACT;
    const readColors = () => {
      REST = rgb(ds.rest || token("--ink", "#141413"));
      ACT = rgb(ds.active || token("--signal", "#FF6E40"));
    };
    readColors();
    new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", readColors);
    const RA = Number(ds.restAlpha ?? .2);
    const DEN = Number(ds.density ?? 1);
    const scope = canvas.parentElement;
    const state = { form: 0, formTarget: 0, box: null, x: -4000, y: -4000, tx: -4000, ty: -4000 };
    let visible = true;

    const measure = () => {
      const base = canvas.getBoundingClientRect();
      if (base.width < 1 || base.height < 1) return;
      const W = Math.ceil(base.width * SCALE), H = Math.ceil(base.height * SCALE);
      for (const c of [sharp, soft]) { c.width = W; c.height = H; }
      size = [base.width, base.height];
      sctx.setTransform(SCALE, 0, 0, SCALE, -base.left * SCALE, -base.top * SCALE);
      sctx.fillStyle = sctx.strokeStyle = "#000";
      sctx.lineJoin = "round";
      // The letters as they are: no padding, so no patch of clear ground forms behind a word.
      sctx.lineWidth = blur ? 0 : 1;
      if (ds.quiet) for (const el of document.querySelectorAll(ds.quiet)) {
        const r = el.getBoundingClientRect();
        if (r.bottom < base.top - 60 || r.top > base.bottom + 60) continue;
        drawText(sctx, el);
      }
      if (ds.solid) for (const el of document.querySelectorAll(ds.solid)) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || el.closest("[hidden]")) continue;
        const rad = Math.min(r.height / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
        sctx.beginPath();
        sctx.roundRect ? sctx.roundRect(r.left, r.top, r.width, r.height, rad) : sctx.rect(r.left, r.top, r.width, r.height);
        sctx.fill();
      }
      fctx.clearRect(0, 0, W, H);
      if (blur) fctx.filter = "blur(1.5px)";
      fctx.drawImage(sharp, 0, 0);
      fctx.filter = "none";
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, gl.ALPHA, gl.UNSIGNED_BYTE, soft);
    };
    let queued = false;
    const remeasure = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; measure(); }); };

    scope.addEventListener("pointermove", (e) => {
      const b = canvas.getBoundingClientRect();
      state.tx = e.clientX - b.left; state.ty = e.clientY - b.top;
    }, { passive: true });
    scope.addEventListener("pointerleave", () => { state.tx = state.ty = -4000; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) remeasure(); }).observe(canvas);
    addEventListener("resize", remeasure);
    document.fonts?.ready.then(remeasure);
    new MutationObserver(remeasure).observe(scope, { subtree: true, attributes: true, attributeFilter: ["hidden", "class"], childList: true, characterData: true });
    scope.addEventListener("input", remeasure);

    const t0 = performance.now();
    const frame = () => {
      requestAnimationFrame(frame);
      if (!visible) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; remeasure(); }
      state.x += (state.tx - state.x) * .08; state.y += (state.ty - state.y) * .08;
      state.form += (state.formTarget - state.form) * .045;
      const base = canvas.getBoundingClientRect();
      const bx = state.box ? state.box.getBoundingClientRect() : null;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.R, w, h);
      gl.uniform1f(U.T, reduce ? 0 : (performance.now() - t0) / 1000);
      gl.uniform2f(U.M, state.x, state.y);
      gl.uniform1f(U.F, state.form);
      gl.uniform4f(U.B, bx ? bx.left - base.left : -9999, bx ? bx.top - base.top : -9999, bx ? bx.width : 0, bx ? bx.height : 0);
      gl.uniform1f(U.D, dpr);
      gl.uniform3fv(U.REST, REST);
      gl.uniform3fv(U.ACT, ACT);
      gl.uniform1f(U.RA, RA);
      gl.uniform1f(U.DEN, DEN);
      gl.uniform1i(U.TX, 0);
      gl.uniform2f(U.TS, size[0], size[1]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    measure();
    requestAnimationFrame(frame);
    fields.set(canvas, {
      set form(v) { state.formTarget = v; },
      set box(el) { state.box = el; },
      measure,
    });
  }

  document.querySelectorAll("canvas[data-field]").forEach(init);
})();
