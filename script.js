(function () {
  "use strict";

  /* ============================================================
     CONFIG — edit these to match your business
  ============================================================ */
  const LEAD_EMAIL = "wayne.walsh1@gmail.com"; // where quote requests are sent
  const FORM_ENDPOINT = "https://formsubmit.co/ajax/" + LEAD_EMAIL;
  const MAX_PHOTOS = 5;
  const MAX_PHOTO_MB = 5;

  /* ============================================================
     PRICING RATES — UK averages, GBP. Update as your costs change.
  ============================================================ */
  const RATES = {
    patio: {
      label: "Patio / Paving",
      tiers: {
        budget: { label: "Budget", meta: "Concrete / textured slabs", rate: 75 },
        standard: { label: "Standard", meta: "Sandstone / textured paving", rate: 115 },
        premium: { label: "Premium", meta: "Porcelain / natural stone", rate: 165 },
      },
      removalPerM2: 15,
      difficultAccessMultiplier: 1.12,
      minJob: 600,
    },
    wall: {
      label: "Garden Wall",
      tiers: {
        block: { label: "Block", meta: "Rendered / painted block", rate: 130 },
        brick: { label: "Brick", meta: "Standard facing brick", rate: 160 },
        brickPremium: { label: "Premium Brick", meta: "Feature / double-skin", rate: 200 },
        stone: { label: "Natural Stone", meta: "Dressed stone facing", rate: 270 },
      },
      retainingExtra: 50,
      minJob: 450,
    },
    steps: {
      label: "Garden Steps",
      tiers: {
        concrete: { label: "Concrete / Sleeper", meta: "Budget-friendly", rate: 160 },
        brick: { label: "Brick / Block", meta: "Most popular", rate: 210 },
        stone: { label: "Natural Stone", meta: "Premium finish", rate: 290 },
      },
      minJob: 450,
    },
    tidy: {
      label: "Garden Tidy-Up",
      sizes: {
        small: { label: "Small", meta: "Courtyard / small yard", base: 150 },
        medium: { label: "Medium", meta: "Average family garden", base: 300 },
        large: { label: "Large", meta: "Large plot", base: 550 },
      },
      condition: {
        light: { label: "Light tidy", mult: 1 },
        moderate: { label: "Moderately overgrown", mult: 1.3 },
        heavy: { label: "Heavily overgrown", mult: 1.7 },
      },
    },
    renovation: {
      label: "Full Garden Renovation",
      sizes: {
        small: { label: "Small", meta: "Up to 40m²", range: [3000, 7000] },
        medium: { label: "Medium", meta: "40–100m²", range: [7000, 15000] },
        large: { label: "Large", meta: "100m²+", range: [15000, 30000] },
      },
      scope: {
        essential: { label: "Essential refresh", lo: 0, hi: 0.4 },
        complete: { label: "Complete transformation", lo: 0.3, hi: 0.75 },
        premium: { label: "Premium bespoke design", lo: 0.6, hi: 1.3 },
      },
    },
    subscription: {
      label: "Garden Maintenance",
      sizes: {
        small: { label: "Small", meta: "Courtyard / small yard", perVisit: 22 },
        medium: { label: "Medium", meta: "Average family garden", perVisit: 60 },
        large: { label: "Large", meta: "Large plot", perVisit: 110 },
      },
      fortnightlyDiscount: 0.95,
    },
  };

  const fmt = (n) => "£" + Math.round(n / 5) * 5 >= 1000
    ? "£" + (Math.round(n / 5) * 5).toLocaleString("en-GB")
    : "£" + Math.round(n / 5) * 5;

  const roundTo5 = (n) => Math.round(n / 5) * 5;

  /* ============================================================
     STATE
  ============================================================ */
  const state = {
    service: null,
    answers: {},
    estimate: null, // { low, high, note, perVisit }
    photos: [], // File[]
  };

  /* ============================================================
     DOM refs
  ============================================================ */
  const quoteTool = document.getElementById("quoteTool");
  const panels = quoteTool.querySelectorAll(".quote-panel");
  const progressSteps = quoteTool.querySelectorAll(".progress-step");
  const dynamicFields = document.getElementById("dynamicFields");
  const step2Title = document.getElementById("step2Title");
  const estimateValue = document.getElementById("estimateValue");
  const estimateNote = document.getElementById("estimateNote");
  const toStep3Btn = document.getElementById("toStep3Btn");
  const summaryBanner = document.getElementById("summaryBanner");
  const descriptionField = document.getElementById("description");
  const formSubjectField = document.getElementById("formSubject");
  const estimateSummaryField = document.getElementById("estimateSummaryField");
  const quoteForm = document.getElementById("quoteForm");
  const formStatus = document.getElementById("formStatus");
  const submitBtn = document.getElementById("submitBtn");
  const successEstimate = document.getElementById("successEstimate");
  const successPhotoNote = document.getElementById("successPhotoNote");

  /* ============================================================
     NAV: mobile toggle + smooth-scroll service links
  ============================================================ */
  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");
  navToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  mainNav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => mainNav.classList.remove("is-open"))
  );

  document.querySelectorAll("[data-service-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const svc = el.getAttribute("data-service-link");
      selectService(svc);
      mainNav.classList.remove("is-open");
    });
  });

  /* ============================================================
     PANEL / PROGRESS NAVIGATION
  ============================================================ */
  function showPanel(name) {
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === String(name)));
    const stepNum = name === "success" ? 3 : Number(name);
    progressSteps.forEach((s) => {
      const n = Number(s.dataset.progress);
      s.classList.toggle("is-active", n === stepNum);
      s.classList.toggle("is-done", n < stepNum);
    });
    if (name !== 1) {
      quoteTool.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  document.querySelectorAll('[data-action="back-to-1"]').forEach((b) =>
    b.addEventListener("click", () => showPanel(1))
  );
  document.querySelectorAll('[data-action="back-to-2"]').forEach((b) =>
    b.addEventListener("click", () => showPanel(2))
  );

  quoteTool.querySelectorAll(".service-select-card").forEach((card) => {
    card.addEventListener("click", () => selectService(card.dataset.service));
  });

  function selectService(svc) {
    state.service = svc;
    state.answers = {};
    quoteTool.querySelectorAll(".service-select-card").forEach((c) =>
      c.classList.toggle("is-selected", c.dataset.service === svc)
    );
    renderQuestions(svc);
    showPanel(2);
    document.getElementById("quote-tool").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============================================================
     RENDER DYNAMIC QUESTIONS PER SERVICE
  ============================================================ */
  function renderQuestions(svc) {
    dynamicFields.innerHTML = "";
    step2Title.textContent = "Tell us about your " + RATES[svc].label.toLowerCase() + " job";
    toStep3Btn.disabled = true;
    estimateValue.textContent = "—";
    estimateNote.textContent = "Answer the questions to see a live price.";

    if (svc === "patio") {
      dynamicFields.appendChild(
        numberField("area", "Approximate patio size (m²)", "e.g. 18", "Tip: multiply length × width in metres. E.g. 4m × 3m = 12m².")
      );
      dynamicFields.appendChild(optionCardGroup("tier", "Which finish?", RATES.patio.tiers, (t) => `From £${t.rate}/m²`));
      dynamicFields.appendChild(toggleField("removal", "Remove an old patio / slabs first?"));
      dynamicFields.appendChild(toggleField("difficultAccess", "Is access to the garden difficult (e.g. through the house, narrow gate)?"));
    }

    if (svc === "wall") {
      dynamicFields.appendChild(numberField("length", "Wall length (metres)", "e.g. 8"));
      dynamicFields.appendChild(numberField("height", "Wall height (metres)", "e.g. 1.2"));
      dynamicFields.appendChild(optionCardGroup("tier", "Wall type", RATES.wall.tiers, (t) => `From £${t.rate}/m²`));
      dynamicFields.appendChild(toggleField("retaining", "Is this a retaining wall (holding back a bank / slope of earth)?"));
    }

    if (svc === "steps") {
      dynamicFields.appendChild(numberField("count", "How many steps do you need?", "e.g. 5"));
      dynamicFields.appendChild(optionCardGroup("tier", "Material", RATES.steps.tiers, (t) => `From £${t.rate}/step`));
    }

    if (svc === "tidy") {
      dynamicFields.appendChild(optionCardGroup("size", "Garden size", RATES.tidy.sizes, (t) => `From £${t.base}`));
      dynamicFields.appendChild(optionCardGroup("condition", "Current condition", RATES.tidy.condition, () => ""));
      dynamicFields.appendChild(toggleField("waste", "Do you need the green waste taken away?", "Waste disposal isn't included — we'll quote it separately once we know what's involved."));
    }

    if (svc === "renovation") {
      dynamicFields.appendChild(optionCardGroup("size", "Approx. total garden size", RATES.renovation.sizes, (t) => `£${t.range[0].toLocaleString()}–£${t.range[1].toLocaleString()}`));
      dynamicFields.appendChild(optionCardGroup("scope", "What are you hoping for?", RATES.renovation.scope, () => ""));
      dynamicFields.appendChild(checkboxGroup("elements", "Which elements are involved? (optional)", [
        "Patio / paving", "Lawn / turf", "Planting & borders", "Fencing", "Lighting", "Decking", "Water feature",
      ]));
    }

    if (svc === "subscription") {
      dynamicFields.appendChild(optionCardGroup("size", "Garden size", RATES.subscription.sizes, (t) => `From £${t.perVisit}/visit`));
      dynamicFields.appendChild(optionCardGroup("frequency", "How often would you like visits?", {
        fortnightly: { label: "Fortnightly", meta: "Spring / summer growing season" },
        monthly: { label: "Monthly", meta: "Quieter autumn / winter upkeep" },
      }, () => ""));
    }

    bindDynamicInputs(svc);
  }

  function numberField(key, label, placeholder, hint) {
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    wrap.innerHTML = `
      <label class="field-label" for="f_${key}">${label}</label>
      ${hint ? `<p class="field-hint">${hint}</p>` : ""}
      <input type="number" id="f_${key}" data-key="${key}" min="0" step="0.5" inputmode="decimal" placeholder="${placeholder || ""}">
    `;
    return wrap;
  }

  function optionCardGroup(key, label, options, metaFn) {
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    const cards = Object.entries(options)
      .map(([val, o]) => {
        const meta = metaFn(o) || o.meta || "";
        return `
        <label class="option-card" data-key="${key}" data-val="${val}">
          <input type="radio" name="opt_${key}" value="${val}">
          <span class="opt-title">${o.label}</span>
          ${meta ? `<span class="opt-meta">${meta}</span>` : ""}
        </label>`;
      })
      .join("");
    wrap.innerHTML = `<span class="field-label">${label}</span><div class="option-cards">${cards}</div>`;
    return wrap;
  }

  function toggleField(key, label, hint) {
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    wrap.innerHTML = `
      <span class="field-label">${label}</span>
      ${hint ? `<p class="field-hint">${hint}</p>` : ""}
      <div class="toggle-row">
        <label class="toggle-btn" data-key="${key}" data-val="yes"><input type="radio" name="tog_${key}" value="yes">Yes</label>
        <label class="toggle-btn" data-key="${key}" data-val="no"><input type="radio" name="tog_${key}" value="no">No</label>
      </div>
    `;
    return wrap;
  }

  function checkboxGroup(key, label, items) {
    const wrap = document.createElement("div");
    wrap.className = "field-group";
    const pills = items
      .map(
        (item, i) => `
        <label class="checkbox-pill">
          <input type="checkbox" data-key="${key}" value="${item}">
          <span>${item}</span>
        </label>`
      )
      .join("");
    wrap.innerHTML = `<span class="field-label">${label}</span><div class="checkbox-grid">${pills}</div>`;
    return wrap;
  }

  function bindDynamicInputs(svc) {
    dynamicFields.querySelectorAll('input[type="number"]').forEach((inp) => {
      inp.addEventListener("input", () => {
        state.answers[inp.dataset.key] = inp.value ? parseFloat(inp.value) : null;
        recompute();
      });
    });

    dynamicFields.querySelectorAll(".option-card").forEach((card) => {
      card.addEventListener("click", () => {
        const key = card.dataset.key;
        dynamicFields.querySelectorAll(`.option-card[data-key="${key}"]`).forEach((c) => c.classList.remove("is-checked"));
        card.classList.add("is-checked");
        card.querySelector("input").checked = true;
        state.answers[key] = card.dataset.val;
        recompute();
      });
    });

    dynamicFields.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        dynamicFields.querySelectorAll(`.toggle-btn[data-key="${key}"]`).forEach((b) => b.classList.remove("is-checked"));
        btn.classList.add("is-checked");
        btn.querySelector("input").checked = true;
        state.answers[key] = btn.dataset.val === "yes";
        recompute();
      });
    });

    dynamicFields.querySelectorAll('.checkbox-pill input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const key = cb.dataset.key;
        const checked = Array.from(
          dynamicFields.querySelectorAll(`input[data-key="${key}"]:checked`)
        ).map((c) => c.value);
        state.answers[key] = checked;
        recompute();
      });
    });
  }

  /* ============================================================
     PRICE CALCULATION
  ============================================================ */
  function computeEstimate() {
    const svc = state.service;
    const a = state.answers;
    if (!svc) return null;

    if (svc === "patio") {
      if (!a.area || !a.tier) return null;
      const rate = RATES.patio.tiers[a.tier].rate;
      let base = a.area * rate;
      if (a.removal) base += a.area * RATES.patio.removalPerM2;
      if (a.difficultAccess) base *= RATES.patio.difficultAccessMultiplier;
      base = Math.max(base, RATES.patio.minJob);
      return { low: roundTo5(base * 0.9), high: roundTo5(base * 1.15), note: `${a.area}m² · ${RATES.patio.tiers[a.tier].label} finish` };
    }

    if (svc === "wall") {
      if (!a.length || !a.height || !a.tier) return null;
      const area = a.length * a.height;
      const rate = RATES.wall.tiers[a.tier].rate;
      let base = area * rate;
      if (a.retaining) base += area * RATES.wall.retainingExtra;
      base = Math.max(base, RATES.wall.minJob);
      return { low: roundTo5(base * 0.9), high: roundTo5(base * 1.15), note: `${area.toFixed(1)}m² wall face · ${RATES.wall.tiers[a.tier].label}` };
    }

    if (svc === "steps") {
      if (!a.count || !a.tier) return null;
      const rate = RATES.steps.tiers[a.tier].rate;
      let base = a.count * rate;
      base = Math.max(base, RATES.steps.minJob);
      return { low: roundTo5(base * 0.9), high: roundTo5(base * 1.15), note: `${a.count} steps · ${RATES.steps.tiers[a.tier].label}` };
    }

    if (svc === "tidy") {
      if (!a.size || !a.condition) return null;
      const base0 = RATES.tidy.sizes[a.size].base;
      const mult = RATES.tidy.condition[a.condition].mult;
      let base = base0 * mult;
      return { low: roundTo5(base * 0.9), high: roundTo5(base * 1.2), note: `${RATES.tidy.sizes[a.size].label} garden · ${RATES.tidy.condition[a.condition].label}` };
    }

    if (svc === "renovation") {
      if (!a.size || !a.scope) return null;
      const [lo, hi] = RATES.renovation.sizes[a.size].range;
      const scope = RATES.renovation.scope[a.scope];
      const spread = hi - lo;
      const low = lo + spread * scope.lo;
      const high = lo + spread * scope.hi;
      return { low: roundTo5(low), high: roundTo5(high), note: `${RATES.renovation.sizes[a.size].label} garden · ${scope.label}` };
    }

    if (svc === "subscription") {
      if (!a.size || !a.frequency) return null;
      const perVisit = RATES.subscription.sizes[a.size].perVisit;
      const discount = a.frequency === "fortnightly" ? RATES.subscription.fortnightlyDiscount : 1;
      const adjusted = perVisit * discount;
      return {
        low: roundTo5(adjusted * 0.9),
        high: roundTo5(adjusted * 1.15),
        note: `${RATES.subscription.sizes[a.size].label} garden · ${a.frequency === "fortnightly" ? "Fortnightly" : "Monthly"} visits`,
        perVisit: true,
      };
    }

    return null;
  }

  function recompute() {
    const est = computeEstimate();
    state.estimate = est;
    if (!est) {
      estimateValue.textContent = "—";
      estimateNote.textContent = "Answer the questions to see a live price.";
      toStep3Btn.disabled = true;
      return;
    }
    const suffix = est.perVisit ? " per visit" : "";
    estimateValue.textContent = `£${est.low.toLocaleString("en-GB")}–£${est.high.toLocaleString("en-GB")}${suffix}`;
    estimateNote.textContent = est.note;
    toStep3Btn.disabled = false;
  }

  toStep3Btn.addEventListener("click", () => {
    prepareStep3();
    showPanel(3);
  });

  /* ============================================================
     STEP 3: summary + prefilled description
  ============================================================ */
  function prepareStep3() {
    const svc = state.service;
    const est = state.estimate;
    const label = RATES[svc].label;
    const suffix = est.perVisit ? " per visit" : "";
    summaryBanner.textContent = `${label} — instant estimate: £${est.low.toLocaleString("en-GB")}–£${est.high.toLocaleString("en-GB")}${suffix} (${est.note})`;
    formSubjectField.value = `New ${label} quote request`;
    estimateSummaryField.value = `${label} | Estimate: £${est.low}-£${est.high}${suffix} | ${est.note} | Answers: ${JSON.stringify(state.answers)}`;

    if (!descriptionField.value) {
      descriptionField.value = buildPrefillDescription(svc, state.answers);
    }
  }

  function buildPrefillDescription(svc, a) {
    if (svc === "patio") {
      return `I'd like a patio of approximately ${a.area}m², ${RATES.patio.tiers[a.tier].label.toLowerCase()} finish (${RATES.patio.tiers[a.tier].meta}).${a.removal ? " Old patio/slabs need removing." : ""}${a.difficultAccess ? " Access to the garden is difficult." : ""}`;
    }
    if (svc === "wall") {
      return `I'd like a garden wall approx ${a.length}m long × ${a.height}m high, ${RATES.wall.tiers[a.tier].label.toLowerCase()} (${RATES.wall.tiers[a.tier].meta}).${a.retaining ? " This is a retaining wall." : ""}`;
    }
    if (svc === "steps") {
      return `I need approximately ${a.count} garden steps, ${RATES.steps.tiers[a.tier].label.toLowerCase()} finish.`;
    }
    if (svc === "tidy") {
      return `I need a ${RATES.tidy.sizes[a.size].label.toLowerCase()} garden tidy-up. Current condition: ${RATES.tidy.condition[a.condition].label.toLowerCase()}.${a.waste ? " Please include green waste removal." : ""}`;
    }
    if (svc === "renovation") {
      const elements = (a.elements || []).join(", ");
      return `I'm looking for a full garden renovation — ${RATES.renovation.sizes[a.size].label.toLowerCase()} garden, ${RATES.renovation.scope[a.scope].label.toLowerCase()}.${elements ? ` Elements involved: ${elements}.` : ""}`;
    }
    if (svc === "subscription") {
      return `I'd like ongoing garden maintenance for a ${RATES.subscription.sizes[a.size].label.toLowerCase()} garden, ${a.frequency} visits.`;
    }
    return "";
  }

  /* ============================================================
     PHOTO UPLOAD
  ============================================================ */
  const dropzone = document.getElementById("dropzone");
  const photoInput = document.getElementById("photos");
  const photoPreviews = document.getElementById("photoPreviews");

  dropzone.addEventListener("click", () => photoInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      photoInput.click();
    }
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
    handleFiles(e.dataTransfer.files);
  });
  photoInput.addEventListener("change", () => handleFiles(photoInput.files));

  function handleFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    for (const file of incoming) {
      if (state.photos.length >= MAX_PHOTOS) {
        showFormStatus(`You can upload up to ${MAX_PHOTOS} photos.`, true);
        break;
      }
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        showFormStatus(`"${file.name}" is over ${MAX_PHOTO_MB}MB and was skipped.`, true);
        continue;
      }
      state.photos.push(file);
    }
    renderPhotoPreviews();
    photoInput.value = "";
  }

  function renderPhotoPreviews() {
    photoPreviews.innerHTML = "";
    state.photos.forEach((file, i) => {
      const li = document.createElement("li");
      li.className = "photo-thumb";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = `Uploaded photo ${i + 1}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Remove photo ${i + 1}`);
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        state.photos.splice(i, 1);
        renderPhotoPreviews();
      });
      li.appendChild(img);
      li.appendChild(btn);
      photoPreviews.appendChild(li);
    });
  }

  /* ============================================================
     FORM SUBMIT
  ============================================================ */
  function showFormStatus(msg, isError) {
    formStatus.textContent = msg;
    formStatus.classList.toggle("is-error", !!isError);
    formStatus.classList.toggle("is-success", !isError);
  }

  quoteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!quoteForm.checkValidity()) {
      quoteForm.reportValidity();
      return;
    }
    // honeypot check
    if (quoteForm.querySelector('[name="_honey"]').value) return;

    submitBtn.disabled = true;
    submitBtn.classList.add("is-loading");
    showFormStatus("", false);

    try {
      const formData = new FormData(quoteForm);
      state.photos.forEach((file) => formData.append("attachment", file, file.name));

      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) throw new Error("Request failed");

      const est = state.estimate;
      const suffix = est && est.perVisit ? " per visit" : "";
      successEstimate.textContent = est
        ? `Your instant estimate: £${est.low.toLocaleString("en-GB")}–£${est.high.toLocaleString("en-GB")}${suffix}`
        : "";
      successPhotoNote.textContent = state.photos.length ? ` and ${state.photos.length} photo${state.photos.length > 1 ? "s" : ""}` : "";
      showPanel("success");
      quoteForm.reset();
      state.photos = [];
      renderPhotoPreviews();
    } catch (err) {
      showFormStatus("Sorry, something went wrong sending your request. Please try again, or email us directly at " + LEAD_EMAIL + ".", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
    }
  });

  document.getElementById("startOverBtn").addEventListener("click", () => {
    state.service = null;
    state.answers = {};
    state.estimate = null;
    quoteTool.querySelectorAll(".service-select-card").forEach((c) => c.classList.remove("is-selected"));
    showPanel(1);
  });

  /* ============================================================
     MISC
  ============================================================ */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
