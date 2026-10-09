// PeptideScope: screen-space callouts anchored to 3D points (body).
// Labels live in #callout-layer as real HTML (focusable buttons for organs), positioned every frame
// with stage.project, hidden when their anchor is off-screen, with a thin elbow leader line to a
// small anchor dot, and a simple per-side vertical relaxation so labels never pile up.
//
//   const callouts = createCallouts(stage, layerEl, { onSelect(organId, item) {} });
//   callouts.set(id, { anchor: Vector3 | [x,y,z] | () => Vector3, title, text, tone, organ, group,
//                      interactive = true, side = 'auto' | 'left' | 'right' | 'below' | 'above',
//                      normal?: Vector3, facing = 0.05, onClick?, ariaLabel?, priority?, keep? })
// 'left' / 'right' labels stack in a column beside their anchors; 'below' / 'above' labels form one
// row under (over) all their anchors with vertical leaders (used for the tissue cross-section).
// `normal` marks a surface anchor: the label hides while that surface faces away from the camera
// (cosine between the normal and the direction to the camera below `facing`), for example the skin
// of the cheek seen from behind the head.
// Labels that point at the same organ are de-duplicated (highest priority wins: hover > tissue > risk >
// effects > arrival > focus > sites). v4 fix (teen-ux review, "bunched up"): how many full labels show
// depends on the stage width (3 under 600 px, 5 under 900 px, else 6), the most important first
// (serious > the injection site > organs); a label marked `keep` is never dropped for space. Interactive
// labels that do not fit become small tappable dots at their anchor ("ps-callout-mini"): a tap opens
// that label (it then outranks the others until another dot is tapped).
// Hover labels only move HTML, so they lay out on their own without asking the 3D stage for a frame.
//   callouts.remove(id); callouts.clear(group?); callouts.setGroupVisible(group, bool);
//   callouts.setInsets({ top, right, bottom, left }) (extra px kept clear, e.g. under the skip button); callouts.dispose()
// tone: 'info' | 'warn' | 'danger' | 'drug' | 'tissue' | 'site'
// v4: labels are placed during the stage's frames, which only run while something changes, so every
// change here asks the stage for a frame (stage.invalidate).
const SVG_NS = 'http://www.w3.org/2000/svg';

export function createCallouts(stage, layer, { onSelect } = {}) {
  if (!layer) throw new Error('createCallouts: layer element required');
  layer.classList.add('ps-callouts');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ps-callout-leaders');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  layer.appendChild(svg);
  const list = document.createElement('div');
  list.className = 'ps-callout-list';
  layer.appendChild(list);

  const items = new Map();
  const hiddenGroups = new Set();
  // Higher wins when two labels point at the same organ, and when a small stage has to drop labels.
  const GROUP_PRIORITY = { hover: 9, tissue: 8, risk: 7, effects: 5, arrival: 4, focus: 3, sites: 2 };
  const visible = [];
  const bestByOrgan = new Map();
  const rank = (it) => (it.expanded ? 100 + it.expanded / 1e6 : 0) + it.prio;
  const byRank = (a, b) => rank(b) - rank(a);
  const left = [];
  const right = [];
  const below = [];
  const above = [];
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const proj = { x: 0, y: 0, visible: false, depth: 0 };
  const camToAnchor = { x: 0, y: 0, z: 0 };
  const byX = (a, b) => a.x - b.x;
  const byY = (a, b) => a.wantY - b.wantY;
  let disposed = false;
  const inv = () => stage.invalidate?.();
  // layout without a 3D frame (hover labels): positions come from stage.project, which needs no render
  let layoutRaf = 0;
  const layoutOnly = () => {
    if (layoutRaf || disposed) return;
    layoutRaf = requestAnimationFrame(() => { layoutRaf = 0; update(); });
  };
  const changed = (it) => (it && it.group === 'hover' ? layoutOnly() : inv());
  let expandSeq = 0;

  function anchorOf(it) {
    const a = it.anchor;
    if (typeof a === 'function') return a();
    return a;
  }

  function build(it) {
    const tag = it.interactive ? 'button' : 'div';
    const el = document.createElement(tag);
    if (it.interactive) {
      el.type = 'button';
      el.addEventListener('click', () => {
        if (typeof it.onClick === 'function') it.onClick(it);
        else if (it.organ) onSelect?.(it.organ, it);
      });
    } else {
      el.setAttribute('role', 'note');
    }
    const title = document.createElement('span');
    title.className = 'ps-callout__title';
    const text = document.createElement('span');
    text.className = 'ps-callout__text';
    el.append(title, text);
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(SVG_NS, 'polyline');
    it.el = el; it.titleEl = title; it.textEl = text; it.dot = dot; it.line = line;
    // start hidden; update() reveals it once it has a position
    el.hidden = true; dot.hidden = true; line.style.display = 'none';
    list.appendChild(el);
    layer.insertBefore(dot, list);
    svg.appendChild(line);
    // the small tappable dot this label folds into when there is no room for it
    if (it.interactive) {
      const mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 'ps-callout-mini';
      mini.hidden = true;
      mini.addEventListener('click', () => { it.expanded = ++expandSeq; inv(); layoutOnly(); });
      it.mini = mini;
      list.appendChild(mini);
    }
  }

  function set(id, opts = {}) {
    if (disposed) return null;
    let it = items.get(id);
    const interactive = opts.interactive !== false;
    if (it && it.interactive !== interactive) { remove(id); it = null; }
    if (!it) {
      it = { id, interactive, shown: false, x: -1, y: -1, lx: -1e4, ly: -1e4, w: 0, h: 0, wantY: 0, side: 'right', measured: false };
      build(it);
      items.set(id, it);
    }
    it.anchor = opts.anchor ?? it.anchor;
    it.organ = opts.organ ?? it.organ ?? null;
    it.onClick = opts.onClick ?? it.onClick ?? null;
    it.ariaLabel = opts.ariaLabel ?? it.ariaLabel ?? null;
    it.group = opts.group ?? it.group ?? 'default';
    it.sidePref = opts.side ?? it.sidePref ?? 'auto';
    it.normal = opts.normal ?? it.normal ?? null;
    it.facing = Number.isFinite(opts.facing) ? opts.facing : it.facing ?? 0.05;
    it.prio = opts.priority ?? ((GROUP_PRIORITY[it.group] ?? 1) + ((opts.tone ?? it.tone) === 'danger' ? 0.5 : 0));
    it.keep = opts.keep ?? it.keep ?? false;
    const tone = opts.tone ?? it.tone ?? 'info';
    const title = opts.title ?? it.title ?? '';
    const text = opts.text ?? it.text ?? '';
    if (tone !== it.tone || title !== it.title || text !== it.text) {
      it.tone = tone; it.title = title; it.text = text;
      it.el.className = `ps-callout ps-callout--${tone}${it.interactive ? ' ps-callout--interactive' : ''}`;
      it.dot.className = `ps-callout-dot ps-callout-dot--${tone}`;
      it.line.setAttribute('class', `ps-callout-line ps-callout-line--${tone}`);
      it.titleEl.textContent = title;
      it.textEl.textContent = text;
      it.textEl.hidden = !text;
      if (it.organ) it.el.dataset.organ = it.organ;
      if (it.interactive) {
        it.el.setAttribute('aria-label', it.ariaLabel || `${title}${text ? `: ${text}` : ''}. Show on the body.`);
      }
      if (it.mini) {
        it.mini.className = `ps-callout-mini ps-callout-mini--${tone}`;
        it.mini.setAttribute('aria-label', `${title}${text ? `: ${text}` : ''}. Show this label.`);
      }
      it.measured = false;
    }
    changed(it);
    return it;
  }

  function remove(id) {
    const it = items.get(id);
    if (!it) return;
    it.el.remove(); it.dot.remove(); it.line.remove(); it.mini?.remove();
    items.delete(id);
    changed(it);
  }
  function clear(group) {
    for (const [id, it] of [...items]) if (!group || it.group === group) remove(id);
  }
  function setGroupVisible(group, visible) {
    if (visible === !hiddenGroups.has(group)) return;
    if (visible) hiddenGroups.delete(group); else hiddenGroups.add(group);
    inv();
  }
  function setInsets(next = {}) {
    for (const k of ['top', 'right', 'bottom', 'left']) if (Number.isFinite(next[k])) insets[k] = next[k];
    inv();
  }

  function show(it, on) {
    if (it.shown === on) return;
    it.shown = on;
    it.el.hidden = !on;
    it.dot.hidden = !on;
    it.line.style.display = on ? '' : 'none';
    if (on) it.measured = false;
  }
  function showMini(it, on) {
    if (!it.mini) return;
    if (on) {
      if (Math.abs(it.x - (it.mx ?? -1)) > 0.3 || Math.abs(it.y - (it.my ?? -1)) > 0.3) {
        it.mx = it.x; it.my = it.y;
        it.mini.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;
      }
    }
    if (it.mini.hidden === !on) return;
    it.mini.hidden = !on;
  }

  function measure(it) {
    // Layout read only when content changed or the label (re)appears.
    it.w = it.el.offsetWidth;
    it.h = it.el.offsetHeight;
    it.measured = it.w > 0;
  }

  function facingAway(it, a) {
    const n = it.normal;
    if (!n) return false;
    const c = stage.camera.position;
    const ax = Array.isArray(a) ? a[0] : a.x, ay = Array.isArray(a) ? a[1] : a.y, az = Array.isArray(a) ? a[2] : a.z;
    camToAnchor.x = c.x - ax; camToAnchor.y = c.y - ay; camToAnchor.z = c.z - az;
    const len = Math.hypot(camToAnchor.x, camToAnchor.y, camToAnchor.z) || 1;
    // a little hysteresis so labels do not flicker at grazing angles
    const lim = it.shown ? it.facing - 0.15 : it.facing;
    return (n.x * camToAnchor.x + n.y * camToAnchor.y + n.z * camToAnchor.z) / len < lim;
  }

  function update() {
    if (disposed) return;
    const W = stage.size.width, H = stage.size.height;
    const compact = W < 560;
    // how many full labels fit (teen-ux review)
    const maxLabels = W < 600 ? 3 : W < 900 ? 5 : 6;
    const offX = compact ? 18 : 34;
    const margin = (compact ? 8 : 14) + insets.left;
    // keep clear of the stage HUD labels, the colour key (under the phase label when narrow) and the
    // Layers / Body buttons in the top-right corner (icon-only and higher up on the narrowest stages)
    // keep clear of the "Body" button (top right), the zoom buttons (bottom right) and the credit line
    const top = (W <= 430 ? 58 : 66) + insets.top;
    const bottom = (W <= 430 ? 44 : 52) + insets.bottom;
    const gap = compact ? 6 : 8;
    const reserveR = (compact ? 14 : 20) + insets.right;
    left.length = 0; right.length = 0; below.length = 0; above.length = 0; visible.length = 0;
    bestByOrgan.clear();
    for (const it of items.values()) {
      const a = anchorOf(it);
      let vis = !!a && !hiddenGroups.has(it.group);
      if (vis) {
        stage.project(a, proj);
        vis = proj.visible && proj.x > -4 && proj.x < W + 4 && proj.y > -4 && proj.y < H + 4 && !facingAway(it, a);
      }
      it.cand = vis;
      if (!vis) continue;
      it.x = proj.x; it.y = proj.y;
      if (it.organ) {
        const b = bestByOrgan.get(it.organ);
        if (!b || it.prio > b.prio) { if (b) b.cand = false; bestByOrgan.set(it.organ, it); } else it.cand = false;
      }
    }
    for (const it of items.values()) { it.folded = false; if (it.cand) visible.push(it); }
    // the most important labels win the room; a label the visitor opened from its dot comes first,
    // and a `keep` label (the injection site) is never dropped
    let room = maxLabels - visible.filter((it) => it.keep).length;
    visible.sort(byRank);
    for (const it of visible) {
      if (it.keep) continue;
      if (room > 0) { room--; continue; }
      it.cand = false;
      it.folded = true;
    }
    for (const it of items.values()) {
      show(it, !!it.cand);
      showMini(it, !!it.folded);
      if (!it.cand) continue;
      if (!it.measured) measure(it);
      let side = it.sidePref;
      if (side === 'below' || side === 'above') {
        it.side = side;
        (side === 'below' ? below : above).push(it);
        continue;
      }
      // fall back to the other side when the label would not fit
      if (side === 'auto') side = it.x < W * 0.5 ? 'left' : 'right';
      if (side === 'left' && it.x - offX - it.w < margin && it.x + offX + it.w < W - reserveR) side = 'right';
      else if (side === 'right' && it.x + offX + it.w > W - reserveR && it.x - offX - it.w > margin) side = 'left';
      it.side = side;
      it.wantY = it.y - it.h / 2;
      (side === 'left' ? left : right).push(it);
    }
    balance(right, left, H - top - bottom, gap, (it) => it.x - offX - it.w >= margin, 'left');
    balance(left, right, H - top - bottom, gap, (it) => it.x + offX + it.w <= W - reserveR, 'right');
    relax(left, H, top, bottom, gap);
    relax(right, H, top, bottom, gap);
    place(left, W, offX, margin, margin);
    place(right, W, offX, margin, reserveR);
    row(below, true, W, H, margin, reserveR, top, bottom, compact ? 8 : 12);
    row(above, false, W, H, margin, reserveR, top, bottom, compact ? 8 : 12);
  }

  // One row of labels under (or over) their anchors, spread horizontally so they never overlap.
  function row(arr, isBelow, W, H, marginL, marginR, top, bottom, gap) {
    if (!arr.length) return;
    arr.sort(byX);
    let edge = isBelow ? -1e9 : 1e9;
    let hMax = 0;
    for (const it of arr) {
      edge = isBelow ? Math.max(edge, it.y) : Math.min(edge, it.y);
      hMax = Math.max(hMax, it.h);
    }
    const off = W < 560 ? 18 : 26;
    let ry = isBelow ? edge + off : edge - off - hMax;
    ry = Math.min(Math.max(top, ry), H - bottom - hMax);
    // ideal: each label centred on its anchor; then sweep left→right to remove overlaps and centre the
    // whole row on its anchors if it had to grow.
    let x = -1e9, pushed = false, mean = 0;
    for (const it of arr) {
      const ideal = it.x - it.w / 2;
      if (ideal < x) pushed = true;
      it.tx = Math.max(ideal, x); x = it.tx + it.w + gap; mean += it.x;
    }
    if (pushed) {
      mean /= arr.length;
      const last = arr[arr.length - 1];
      const shift = mean - (arr[0].tx + last.tx + last.w) / 2;
      for (const it of arr) it.tx += shift;
    }
    // keep inside the stage
    const minX = marginL, maxX = W - marginR;
    const over = arr[arr.length - 1].tx + arr[arr.length - 1].w - maxX;
    if (over > 0) for (const it of arr) it.tx -= over;
    const under = minX - arr[0].tx;
    if (under > 0) for (const it of arr) it.tx += under;
    for (const it of arr) {
      const lx = it.tx, ly = isBelow ? ry : ry + hMax - it.h;
      const labelMoved = Math.abs(lx - it.lx) > 0.3 || Math.abs(ly - it.ly) > 0.3;
      if (labelMoved) {
        it.lx = lx; it.ly = ly;
        it.el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      }
      if (labelMoved || Math.abs(it.x - (it.dx ?? -1)) > 0.3 || Math.abs(it.y - (it.dy ?? -1)) > 0.3) {
        it.dx = it.x; it.dy = it.y;
        it.dot.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;
        const cx = lx + it.w / 2;
        const ey = isBelow ? ly : ly + it.h;
        const kneeY = isBelow ? Math.max(it.y + 4, ey - 10) : Math.min(it.y - 4, ey + 10);
        it.line.setAttribute('points', `${it.x.toFixed(1)},${it.y.toFixed(1)} ${it.x.toFixed(1)},${kneeY.toFixed(1)} ${cx.toFixed(1)},${ey.toFixed(1)}`);
      }
    }
  }

  // When one column holds more labels than fit (many side effects at once), move 'auto' labels whose
  // anchors sit nearest the other side across, as long as they fit there; no per-frame allocation.
  function stackH(arr, gap) {
    let h = 0;
    for (const it of arr) h += it.h + gap;
    return arr.length ? h - gap : 0;
  }
  function balance(from, to, avail, gap, fits, toSide) {
    let fromH = stackH(from, gap);
    let toH = stackH(to, gap);
    while (fromH > avail && from.length > 1) {
      let best = -1;
      for (let i = 0; i < from.length; i++) {
        const it = from[i];
        if (it.sidePref !== 'auto' || !fits(it)) continue;
        if (best < 0 || (toSide === 'left' ? it.x < from[best].x : it.x > from[best].x)) best = i;
      }
      if (best < 0) break;
      const it = from[best];
      if (toH + gap + it.h > avail) break;
      for (let j = best; j < from.length - 1; j++) from[j] = from[j + 1];
      from.length -= 1;
      it.side = toSide;
      to.push(it);
      fromH -= it.h + gap;
      toH += it.h + gap;
    }
  }

  function relax(arr, H, top, bottomPad, gap) {
    if (!arr.length) return;
    arr.sort(byY);
    let y = top;
    for (const it of arr) { it.ty = Math.max(it.wantY, y); y = it.ty + it.h + gap; }
    // push back up if the stack ran past the bottom edge
    let bottom = H - bottomPad;
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (it.ty + it.h > bottom) it.ty = bottom - it.h;
      bottom = it.ty - gap;
    }
    for (const it of arr) if (it.ty < top) it.ty = top;
  }

  function place(arr, W, offX, margin, marginR) {
    for (const it of arr) {
      let lx = it.side === 'left' ? it.x - offX - it.w : it.x + offX;
      lx = Math.min(Math.max(margin, lx), W - marginR - it.w);
      const ly = it.ty;
      const labelMoved = Math.abs(lx - it.lx) > 0.3 || Math.abs(ly - it.ly) > 0.3;
      if (labelMoved) {
        it.lx = lx; it.ly = ly;
        it.el.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      }
      if (labelMoved || Math.abs(it.x - (it.dx ?? -1)) > 0.3 || Math.abs(it.y - (it.dy ?? -1)) > 0.3) {
        it.dx = it.x; it.dy = it.y;
        it.dot.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`;
        const midY = ly + it.h / 2;
        const edgeX = it.side === 'left' ? lx + it.w : lx;
        const elbowX = it.side === 'left' ? Math.min(it.x - 6, edgeX + 12) : Math.max(it.x + 6, edgeX - 12);
        it.line.setAttribute('points', `${it.x.toFixed(1)},${it.y.toFixed(1)} ${elbowX.toFixed(1)},${midY.toFixed(1)} ${edgeX.toFixed(1)},${midY.toFixed(1)}`);
      }
    }
  }

  const offFrame = stage.onFrame(update);
  const ro = new ResizeObserver(() => { for (const it of items.values()) it.measured = false; inv(); });
  ro.observe(layer);

  return {
    set, remove, clear, setGroupVisible, setInsets, update,
    has: (id) => items.has(id),
    get size() { return items.size; },
    dispose() {
      disposed = true;
      offFrame();
      ro.disconnect();
      cancelAnimationFrame(layoutRaf);
      clear();
      svg.remove(); list.remove();
      layer.classList.remove('ps-callouts');
    },
  };
}
