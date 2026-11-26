(function (global) {
    "use strict";
    const mod = (value, n) => ((value % n) + n) % n;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    class ArcCarousel {
        constructor(root, { items, selectedId = null } = {}) {
            if (!(root instanceof HTMLElement)) throw new TypeError("ArcCarousel: wymagany element HTML.");
            this.root = root;
            this.items = [];
            this.position = 0;
            this.target = 0;
            this.drag = null;
            this.raf = 0;
            this.lastTime = 0;
            this.changedId = null;
            this.focusAfterSnap = false;
            this.flashTimer = 0;
            this.destroyed = false;
            this.abort = new AbortController();
            this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
            root.classList.add("arc-menu");
            root.setAttribute("role", "group");
            if (!root.hasAttribute("aria-label")) root.setAttribute("aria-label", "Menu aktywności");
            root.replaceChildren();
            this.slots = [-1, 0, 1].map((offset) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "arc-menu__button";
                button.draggable = false;
                const icon = document.createElement("span");
                icon.className = "arc-menu__icon";
                icon.setAttribute("aria-hidden", "true");
                button.append(icon);
                root.append(button);
                return {
                    offset,
                    button,
                    icon,
                    currentId: null,
                };
            });
            const on = (name, fn, options = {}) =>
                root.addEventListener(name, fn, {
                    ...options,
                    signal: this.abort.signal,
                });
            on("pointerdown", (e) => this.pointerDown(e));
            if (root.parentElement)
                root.parentElement.addEventListener(
                    "pointerdown",
                    (e) => {
                        if (!root.contains(e.target) && this.inWheel(e)) this.pointerDown(e);
                    },
                    { signal: this.abort.signal }
                );
            on("pointermove", (e) => this.pointerMove(e), {
                passive: false,
            });
            on("pointerup", (e) => this.pointerUp(e));
            on("pointercancel", (e) => this.pointerCancel(e));
            on("lostpointercapture", (e) => this.pointerCancel(e));
            on("dragstart", (e) => e.preventDefault());
            // Pointer gestures are handled above. Detail=0 preserves keyboard/assistive activation.
            on("click", (e) => {
                if (e.detail !== 0) return;
                const b = e.target.closest(".arc-menu__button");
                if (b && root.contains(b)) this.tap(Number(b.dataset.logicalIndex));
            });
            on("keydown", (e) => this.keyDown(e));
            if ("ResizeObserver" in global) {
                this.observer = new ResizeObserver(() => {
                    if (this.drag) {
                        this.drag = null;
                        root.classList.remove("is-dragging");
                        this.target = Math.round(this.position);
                    }
                    this.measure();
                    this.render();
                    this.animate();
                });
                this.observer.observe(root);
            } else
                global.addEventListener(
                    "resize",
                    () => {
                        this.measure();
                        this.render();
                    },
                    {
                        signal: this.abort.signal,
                    }
                );
            this.measure();
            this.setItems(items, {
                selectedId,
            });
        }
        validate(items) {
            if (!Array.isArray(items) || items.length < 1)
                throw new TypeError("ArcCarousel: podaj co najmniej jedną ikonę.");
            const seen = new Set();
            return items.map((item) => {
                if (!item || item.id == null) throw new TypeError("Każda ikona potrzebuje id.");
                const id = String(item.id);
                if (!id || seen.has(id)) throw new TypeError("Id ikon muszą być niepuste i unikalne.");
                seen.add(id);
                return {
                    ...item,
                    id,
                    label: String(item.label || id),
                    svg: String(item.svg || ""),
                };
            });
        }
        measure() {
            this.width = Math.max(1, this.root.clientWidth);
            this.height = Math.max(100, this.root.clientHeight);
            // Koło (wartości z kolo.html): środek tuż pod dolną krawędzią ekranu (w układzie menu
            // x = środek, y = 110 px), jeden krok = 56° obrotu koła.
            this.size = 77;
            this.wheelR = 85;
            this.stepRad = (56 * Math.PI) / 180;
            this.spacing = this.wheelR * this.stepRad; // długość łuku na jedną pozycję = tyle przesuwa palec
            this.wheelX = this.width / 2;
            this.wheelY = 110;
        }
        setItems(items, { selectedId = null } = {}) {
            const parsed = this.validate(items);
            this.cancelDrag();
            this.items = parsed;
            const found = parsed.findIndex((item) => item.id === String(selectedId));
            this.position = this.target = found >= 0 ? found : 0;
            this.changedId = null;
            this.slots.forEach((slot) => {
                slot.currentId = null;
                slot.button.classList.remove("is-activated");
            });
            this.render();
            this.emitChange();
            return this;
        }
        getSelected() {
            const index = mod(Math.round(this.position), this.items.length);
            return {
                ...this.items[index],
                index,
            };
        }
        select(id, { animate = true } = {}) {
            const index = this.items.findIndex((item) => item.id === String(id));
            if (index < 0) return false;
            this.cancelDrag();
            const n = this.items.length;
            const nearest = Math.round(this.position);
            let d = mod(index - mod(nearest, n), n);
            if (d > n / 2) d -= n;
            this.target = nearest + d;
            if (!animate || this.reduced) {
                this.position = this.target;
                this.finishSnap();
            } else this.animate();
            return true;
        }
        next() {
            if (this.items.length < 2) return;
            this.cancelDrag();
            this.target = Math.round(this.target) + 1;
            this.animate();
        }
        previous() {
            if (this.items.length < 2) return;
            this.cancelDrag();
            this.target = Math.round(this.target) - 1;
            this.animate();
        }
        render() {
            if (this.destroyed || !this.items.length) return;
            const n = this.items.length,
                center = Math.round(this.position),
                fraction = this.position - center;
            for (const slot of this.slots) {
                const logical = center + slot.offset,
                    r = logical - this.position,
                    a = Math.abs(r),
                    item = this.items[mod(logical, n)];
                const enabled =
                    n === 1
                        ? slot.offset === 0
                        : n === 2
                          ? slot.offset === 0 || slot.offset === (fraction < 0 ? -1 : 1)
                          : true;
                const scale = 1 - 0.2 * Math.min(a, 1),
                    fade = clamp((1.52 - a) / 0.45, 0, 1),
                    opacity = (1 - 0.2 * Math.min(a, 1)) * fade;
                const ang = r * this.stepRad,
                    x = this.wheelX + this.wheelR * Math.sin(ang),
                    y = this.wheelY - this.wheelR * Math.cos(ang);
                if (slot.currentId !== item.id) {
                    slot.icon.innerHTML = item.svg;
                    slot.currentId = item.id;
                    slot.button.classList.remove("is-activated");
                }
                const b = slot.button;
                b.dataset.id = item.id;
                b.dataset.logicalIndex = String(logical);
                b.style.width = this.size + "px";
                b.style.height = this.size + "px";
                b.style.left = x + "px";
                b.style.top = y + "px";
                b.style.transform = `translate(-50%,-50%) scale(${scale})`;
                b.style.opacity = enabled ? String(opacity) : "0";
                b.style.visibility = enabled && opacity > 0.015 ? "visible" : "hidden";
                b.style.pointerEvents = enabled && opacity > 0.1 ? "auto" : "none";
                b.style.zIndex = String(Math.round(20 - a * 5));
                b.style.setProperty("--item-color", item.color || "#e9dfbd");
                b.tabIndex = enabled && slot.offset === 0 ? 0 : -1;
                b.setAttribute("aria-current", String(slot.offset === 0));
                b.setAttribute("aria-label", (slot.offset === 0 ? "Uruchom: " : "Wybierz: ") + item.label);
            }
            // strzałki i zębatka w docku kręcą się razem z kołem (CSS: rotate(calc(var(--wheel) * -56deg)))
            const dock = this.root.parentElement;
            if (dock) dock.style.setProperty("--wheel", this.position.toFixed(4));
        }
        // środek koła i skala w pikselach ekranu
        wheelCentre() {
            const r = this.root.getBoundingClientRect(),
                k = r.width / this.width;
            return { x: r.left + this.wheelX * k, y: r.top + this.wheelY * k, k };
        }
        // koło łapiemy w dowolnym miejscu szkła (nie tylko za ikonę)
        inWheel(e) {
            const c = this.wheelCentre();
            return Math.hypot(e.clientX - c.x, e.clientY - c.y) <= (133 + 14) * c.k;
        }
        pointerDown(e) {
            if (e.button !== 0 || this.drag || this.destroyed) return;
            const b = e.target.closest && e.target.closest(".arc-menu__button");
            cancelAnimationFrame(this.raf);
            this.raf = 0;
            this.focusAfterSnap = false;
            const c = this.wheelCentre();
            this.drag = {
                id: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                start: this.position,
                angle: Math.atan2(e.clientY - c.y, e.clientX - c.x),
                logical: b ? Number(b.dataset.logicalIndex) : null,
                moved: false,
                lastTime: performance.now(),
                velocity: 0,
            };
            try {
                this.root.setPointerCapture(e.pointerId);
            } catch (_) {}
        }
        pointerMove(e) {
            const d = this.drag;
            if (!d || d.id !== e.pointerId) return;
            if (!d.moved) {
                if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return;
                d.moved = true;
                this.root.classList.add("is-dragging");
            }
            e.preventDefault();
            if (this.items.length < 2) return;
            const c = this.wheelCentre(),
                a = Math.atan2(e.clientY - c.y, e.clientX - c.x);
            let da = a - d.angle;
            if (da > Math.PI) da -= 2 * Math.PI;
            if (da < -Math.PI) da += 2 * Math.PI;
            d.angle = a;
            const now = performance.now(),
                dt = now - d.lastTime,
                dp = -da / this.stepRad;
            if (dt > 0) {
                d.velocity = 0.5 * d.velocity + 0.5 * (dp / dt);
                d.lastTime = now;
            }
            // kąt palca względem środka = kąt koła: ruch w prawo = koło w prawo
            this.position += dp;
            this.target = this.position;
            this.render();
        }
        pointerUp(e) {
            const d = this.drag;
            if (!d || d.id !== e.pointerId) return;
            this.drag = null;
            this.root.classList.remove("is-dragging");
            try {
                if (this.root.hasPointerCapture(e.pointerId)) this.root.releasePointerCapture(e.pointerId);
            } catch (_) {}
            if (d.moved) {
                const v = performance.now() - d.lastTime < 90 ? d.velocity : 0;
                this.target = Math.round(this.position + clamp(v * 130, -1.4, 1.4));
                this.animate();
            } else if (d.logical !== null) this.tap(d.logical);
            else {
                this.target = Math.round(this.position);
                this.animate();
            }
        }
        pointerCancel(e) {
            if (!this.drag || this.drag.id !== e.pointerId) return;
            this.drag = null;
            this.root.classList.remove("is-dragging");
            this.target = Math.round(this.position);
            this.animate();
        }
        cancelDrag() {
            if (!this.drag) return;
            const id = this.drag.id;
            this.drag = null;
            this.root.classList.remove("is-dragging");
            try {
                if (this.root.hasPointerCapture(id)) this.root.releasePointerCapture(id);
            } catch (_) {}
        }
        tap(logical) {
            if (this.destroyed) return;
            const selected = Math.round(this.position),
                settled =
                    Math.abs(this.position - selected) < 0.035 &&
                    Math.abs(this.position - this.target) < 0.035;
            if (logical === selected && settled) {
                this.position = this.target = selected;
                this.render();
                this.activate();
            } else {
                this.target = logical;
                this.animate();
            }
        }
        activate() {
            const detail = this.getSelected();
            clearTimeout(this.flashTimer);
            this.slots.forEach((s) => s.button.classList.remove("is-activated"));
            this.slots[1].button.classList.add("is-activated");
            this.flashTimer = setTimeout(
                () => this.slots.forEach((s) => s.button.classList.remove("is-activated")),
                230
            );
            this.root.dispatchEvent(
                new CustomEvent("arc:activate", {
                    detail,
                    bubbles: true,
                    composed: true,
                })
            );
        }
        emitChange() {
            const detail = this.getSelected();
            if (detail.id === this.changedId) return;
            this.changedId = detail.id;
            this.root.dispatchEvent(
                new CustomEvent("arc:change", {
                    detail,
                    bubbles: true,
                    composed: true,
                })
            );
        }
        finishSnap() {
            this.position = this.target = mod(Math.round(this.target), this.items.length);
            this.render();
            this.emitChange();
            if (this.focusAfterSnap) {
                this.focusAfterSnap = false;
                this.slots[1].button.focus({
                    preventScroll: true,
                });
            }
        }
        animate() {
            if (this.destroyed || this.drag) return;
            if (this.reduced) {
                this.finishSnap();
                return;
            }
            if (this.raf) return;
            this.lastTime = performance.now();
            const frame = (now) => {
                this.raf = 0;
                if (this.destroyed || this.drag) return;
                const dt = Math.min(0.05, (now - this.lastTime) / 1000);
                this.lastTime = now;
                this.position += (this.target - this.position) * (1 - Math.exp(-19 * dt));
                this.render();
                if (Math.abs(this.target - this.position) < 0.002) this.finishSnap();
                else this.raf = requestAnimationFrame(frame);
            };
            this.raf = requestAnimationFrame(frame);
        }
        keyDown(e) {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                this.focusAfterSnap = true;
                if (e.key === "ArrowRight") this.next();
                else this.previous();
            } else if (e.key === "Home" || e.key === "End") {
                e.preventDefault();
                this.focusAfterSnap = true;
                this.select(this.items[e.key === "Home" ? 0 : this.items.length - 1].id);
            }
        }
        destroy() {
            this.cancelDrag();
            this.destroyed = true;
            cancelAnimationFrame(this.raf);
            clearTimeout(this.flashTimer);
            this.abort.abort();
            this.observer?.disconnect();
            this.root.replaceChildren();
            this.root.classList.remove("arc-menu", "is-dragging");
        }
    }
    global.ArcCarousel = ArcCarousel;
})(window);
