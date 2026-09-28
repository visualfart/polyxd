// polyxd.com: the dot field. Every canvas[data-field] on a page gets one: ink dots, as a Riso
// print is made, that drift, swell and change colour under the pointer, and part around every
// word laid over them so the words sit on clear ground. The home page's hero also gathers them
// into a screen (window.PolyxdField.get(canvas).form / .box).
//
//   data-rest, data-rest-alpha   the dots at rest (default: the page's ink at 20%)
//   data-active                  the dots under the pointer (default: signal orange)
//   data-density                 how much of the field is inked (default 1)
//   data-quiet                   selector: text whose every line the dots keep clear of
//   data-solid                   selector: boxes the dots keep clear of (controls, marks)
(() => {
  const MAX = 48;
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
uniform vec3 REST; uniform vec3 ACT; uniform float RA; uniform float DEN; uniform vec4 Q[${MAX}]; uniform int QN;
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
  float near=1e4;
  for(int i=0;i<${MAX};i++){ if(i>=QN) break; near=min(near,box(g,Q[i])); }
  float clear=smoothstep(4.,34.,near);
  float rim=exp(-max(near-6.,0.)/22.)*clear;
  float dens=(smoothstep(.42,.86,flow)*.95)*DEN+pull*.85+rim*.35;
  float condensed=max(inside*.92,halo*.9*(.6+.4*sin(T*3.+sd*.08)));
  dens=mix(dens,max(dens*.18,condensed),F)*clear;
  float rad=cell*.5*clamp(dens,0.,1.);
  float dotm=1.-smoothstep(rad-.7,rad+.7,length(px-g));
  float warm=clamp(pull*1.25+(inside+halo)*F,0.,1.);
  vec3 col=mix(REST,ACT,warm); float a=dotm*mix(RA,1.,warm);
  gl_FragColor=vec4(col*a,a);
}`;

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
    const U = Object.fromEntries(["R", "T", "M", "F", "B", "D", "REST", "ACT", "RA", "DEN", "Q", "QN"].map((k) => [k, gl.getUniformLocation(pr, k)]));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const ds = canvas.dataset;
    const REST = rgb(ds.rest || token("--ink", "#141413"));
    const ACT = rgb(ds.active || token("--signal", "#FF6E40"));
    const RA = Number(ds.restAlpha ?? .2);
    const DEN = Number(ds.density ?? 1);
    const scope = canvas.parentElement;
    const state = { form: 0, formTarget: 0, box: null, x: -4000, y: -4000, tx: -4000, ty: -4000 };
    let rects = new Float32Array(MAX * 4), count = 0, visible = true;

    const measure = () => {
      const base = canvas.getBoundingClientRect();
      const out = [];
      const add = (r, pad = 0) => {
        if (r.width < 1 || r.height < 1 || out.length >= MAX * 4) return;
        if (r.bottom < base.top - 40 || r.top > base.bottom + 40) return;
        out.push(r.left - base.left - pad, r.top - base.top - pad, r.width + pad * 2, r.height + pad * 2);
      };
      if (ds.quiet) for (const el of document.querySelectorAll(ds.quiet)) {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const r of range.getClientRects()) add(r, 2);
      }
      if (ds.solid) for (const el of document.querySelectorAll(ds.solid)) add(el.getBoundingClientRect(), 0);
      rects = new Float32Array(MAX * 4);
      rects.set(out);
      count = out.length / 4;
    };

    scope.addEventListener("pointermove", (e) => {
      const b = canvas.getBoundingClientRect();
      state.tx = e.clientX - b.left; state.ty = e.clientY - b.top;
    }, { passive: true });
    scope.addEventListener("pointerleave", () => { state.tx = state.ty = -4000; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) measure(); }).observe(canvas);
    addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    new MutationObserver(() => requestAnimationFrame(measure)).observe(scope, { subtree: true, attributes: true, attributeFilter: ["hidden", "class"], childList: true });

    const t0 = performance.now();
    const frame = () => {
      requestAnimationFrame(frame);
      if (!visible) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; measure(); }
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
      gl.uniform4fv(U.Q, rects);
      gl.uniform1i(U.QN, count);
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
