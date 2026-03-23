import { initAuthUI, getUserRole, requireAuthOrBlockPage, logout, getTokenPayload } from "./auth-ui.js";
initAuthUI();

if (!requireAuthOrBlockPage()) {

  throw new Error("Authentication required");
}

//initAuthUI();
window.logout = logout;


// ===============================
// 1) DOM references
// ===============================
const actions = document.getElementById("reservationActions");
const resourceNameCnt = document.getElementById("reservationNoteCnt");
const reservationStart = document.getElementById("reservationStart");
const reservationEnd = document.getElementById("reservationEnd");
const reservationIdInput = document.getElementById("reservationId");
const resourceListEl = document.getElementById("reservationList");

const role = getUserRole();
let createButton = null;
let updateButton = null;
let deleteButton = null;
let primaryActionButton = null;
let clearButton = null;
let reservationNoteValid = false
let startTimeValid = false
let endTimeValid = false
let formMode = "create";
let reservationCache = [];
let resourcesCache = [];
let selectedReservationId = null;
let originalState = null;
let originalStateChanged = [false, false, false, false, false, false];

// ===============================
// 2) Button creation helpers
// ===============================

const BUTTON_BASE_CLASSES =
  "w-full rounded-2xl px-6 py-3 text-sm font-semibold transition-all duration-200 ease-out";

const BUTTON_ENABLED_CLASSES =
  "bg-brand-primary text-white hover:bg-brand-dark/80 shadow-soft";

const BUTTON_DISABLED_CLASSES =
  "cursor-not-allowed opacity-50";

function localDateToDateObject(dateString) {
  return new Date(dateString)
}

function addButton({ label, type = "button", value, classes = "" }) {
  const btn = document.createElement("button");
  btn.type = type;
  btn.textContent = label;
  btn.name = "action";
  if (value) btn.value = value;

  btn.className = `${BUTTON_BASE_CLASSES} ${classes}`.trim();

  actions.appendChild(btn);
  return btn;
}

function setButtonEnabled(btn, enabled) {
  if (!btn) return;

  btn.disabled = !enabled;

  // Keep disabled look in ONE place (here)
  btn.classList.toggle("cursor-not-allowed", !enabled);
  btn.classList.toggle("opacity-50", !enabled);

  // Optional: remove hover feel when disabled (recommended UX)
  if (!enabled) {
    btn.classList.remove("hover:bg-brand-dark/80");
  } else {
    // Only re-add if this button is supposed to have it
    // (for Create we know it is)
    if (btn.value === "create" || btn.textContent === "Create") {
      btn.classList.add("hover:bg-brand-dark/80");
    }
  }
}

function renderActionButtons(currentRole) {
  actions.innerHTML = "";
  if (formMode === "create") {
    createButton = addButton({
      label: "Create",
      type: "submit",
      value: "create",
      classes: BUTTON_ENABLED_CLASSES,
    });

    clearButton = addButton({
      label: "Clear",
      type: "button",
      classes: BUTTON_ENABLED_CLASSES,
    });

    setButtonEnabled(createButton, false);
    primaryActionButton = createButton;
    setButtonEnabled(clearButton, true);
    clearButton.addEventListener("click", () => {
      clearResourceForm();
      clearFormMessage();
    });
  }

  if (formMode === "edit") {
    updateButton = addButton({
      label: "Update",
      type: "submit",
      value: "update",
      classes: BUTTON_ENABLED_CLASSES,
    });

    deleteButton = addButton({
      label: "Delete",
      type: "submit",
      value: "delete",
      classes: BUTTON_ENABLED_CLASSES,
    });
    setButtonEnabled(updateButton, false);
    primaryActionButton = updateButton;
    setButtonEnabled(deleteButton, true);
  }
}

function setCurrentResourceId(id) {
  if (!reservationIdInput) return;
  reservationIdInput.value = id ? String(id) : "";
}

// ==========================================
// 3) Input creation + validation + clearing
// ==========================================
function createReservationNoteInput(container) {
  const input = document.createElement("input");

  // Core attributes
  input.id = "reservationNote";
  input.name = "reservationNote";
  input.type = "text";
  input.placeholder = "e.g., Morning meeting";

  // Base Tailwind styling (single source of truth)
  input.className = `
    mt-2 w-full rounded-2xl border border-black/10 bg-white
    px-4 py-3 text-sm outline-none
    focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30
    transition-all duration-200 ease-out
  `;

  container.appendChild(input);
  return input;
}

function isReservationNoteValid(value) {
  const trimmed = value.trim();

  // Allowed characters: A–Z, a–z, 0–9, ä ö å, space, , . - (based on your current regex)
  const allowedPattern = /^[a-zA-Z0-9äöåÄÖÅ \,\.\-]+$/;
  const lengthValid = trimmed.length >= 5 && trimmed.length <= 30;
  const charactersValid = allowedPattern.test(trimmed);
  return lengthValid && charactersValid;
}


function isReservationStartValid(value) {
  return true;
}

function isReservationEndValid(value) {
  return localDateToDateObject(value) > localDateToDateObject(reservationStart.value);
}

function setInputVisualState(input, state) {
  // Reset to neutral base state (remove only our own validation-related classes)
  input.classList.remove(
    "border-green-500",
    "bg-green-100",
    "focus:ring-green-500/30",
    "border-red-500",
    "bg-red-100",
    "focus:ring-red-500/30",
    "focus:border-brand-blue",
    "focus:ring-brand-blue/30"
  );

  // Ensure base focus style is present when neutral
  // (If we are valid/invalid, we override ring color but keep ring behavior)
  input.classList.add("focus:ring-2");

  if (state === "valid") {
    input.classList.add("border-green-500", "bg-green-100", "focus:ring-green-500/30");
  } else if (state === "invalid") {
    input.classList.add("border-red-500", "bg-red-100", "focus:ring-red-500/30");
  }
}

function attachReservationNoteValidation(input) {
  const update = () => {
    const raw = input.value;
    if (raw.trim() === "") {
      setInputVisualState(input, "neutral");
      setButtonEnabled(createButton, false);
      return;
    }
    reservationNoteValid = isReservationNoteValid(raw);

    setInputVisualState(input, reservationNoteValid ? "valid" : "invalid");
    if (raw != originalState?.note) {
      originalStateChanged[0] = true;
    } else {
      originalStateChanged[0] = false;
    }
    refreshPrimaryButtonState();
  };

  // Real-time validation
  input.addEventListener("input", update);

  // Initialize state on page load (Create disabled until valid)
  update();
}

function attachReservationStartValidation(input) {
  const update = () => {
    const raw = input.value;
    if (raw.trim() === "") {
      setInputVisualState(input, "neutral");
      setButtonEnabled(createButton, false);
      return;
    }

    startTimeValid = isReservationStartValid(raw);

    if (startTimeValid) {
      reservationEnd.min = reservationStart.value;
      if (localDateToDateObject(reservationEnd.value) < localDateToDateObject(reservationEnd.min))
        reservationEnd.value = reservationEnd.min;
    }

    setInputVisualState(input, startTimeValid ? "valid" : "invalid");
    if (raw != originalState?.start_time.slice(0, 16)) {
      originalStateChanged[1] = true;
    } else {
      originalStateChanged[1] = false;
    }
    refreshPrimaryButtonState();
  };

  // Real-time validation
  input.addEventListener("input", update);

  // Initialize state on page load (Create disabled until valid)
  update();
}

function attachReservationEndValidation(input, inputStart) {
  const update = () => {
    const raw = input.value;
    if (raw.trim() === "") {
      setInputVisualState(input, "neutral");
      setButtonEnabled(createButton, false);
      return;
    }
    endTimeValid = isReservationEndValid(raw);

    setInputVisualState(input, endTimeValid ? "valid" : "invalid");
    if (raw != originalState?.end_time.slice(0, 16)) {
      originalStateChanged[2] = true;
    } else {
      originalStateChanged[2] = false;
    }
    refreshPrimaryButtonState();
  };

  // Real-time validation
  input.addEventListener("input", update);
  inputStart.addEventListener("input", update);

  // Initialize state on page load (Create disabled until valid)
  update();
}

function attachStateListeners() {
  const listeners = [
    {
      index: 3,  // resourceStart affects element 2
      element: document.getElementById("resourceId"),
      getValue: el => el.value,
      original: originalState?.resourceId
    },
    {
      index: 4,  // resourcePriceUnit affects element 3
      element: document.querySelectorAll('input[name="reservationStatus"]'),
      isRadioGroup: true,
      getValue: el => el.value,
      original: originalState?.status
    }
  ];

  listeners.forEach(item => {
    if (!item.element) return;

    if (item.isRadioGroup) {
      item.element.forEach(radio => {
        radio.addEventListener("change", (e) => {
          updateChangeState(
            item.index,
            item.getValue(e.target),
            item.original
          );
        });
      });
    } else {
      item.element.addEventListener("change", () => {
        updateChangeState(
          item.index,
          item.getValue(item.element),
          item.original
        );
      });
    }
  });
}


function updateChangeState(index, currentValue, originalValue) {
  originalStateChanged[index] = currentValue != originalValue;
  const anyChanged = originalStateChanged.includes(true);
  if (anyChanged) refreshPrimaryButtonState();
}

function refreshPrimaryButtonState() {
  const valid = reservationNoteValid && startTimeValid && endTimeValid;
  if (formMode === "create") {
    setButtonEnabled(primaryActionButton, valid);
  } else {
    setButtonEnabled(primaryActionButton, valid && originalStateChanged.includes(true));
  }
}

// Clear button functionality 
function clearResourceForm() {
  reservationNoteValid = false;
  startTimeValid = false;
  endTimeValid = false;
  originalStateChanged.fill(false);
  reservationNoteInput.value = "";
  reservationNoteInput.dispatchEvent(new Event("input", { bubbles: true }));
  
  const defaultUnit = document.querySelector(
    'input[name="reservationStatus"][value="active"]'
  );
  if (defaultUnit) {
    defaultUnit.checked = true;
  }
  
  if (reservationStart) {
    reservationStart.value = "";
    reservationStart.dispatchEvent(new Event("input", { bubbles: true }));

  }

  if (reservationEnd) {
    reservationEnd.value = "";
    reservationEnd.dispatchEvent(new Event("input", { bubbles: true }));
  }
  setButtonEnabled(createButton, false);
};

function clearFormMessage() {
  const formMsg = document.getElementById("formMessage");
  if (!formMsg) return;
  formMsg.textContent = "";
  formMsg.classList.add("hidden");
};

function renderResourceList(resources) {
  if (!resourceListEl) return;
  resourceListEl.innerHTML = resources
    .map((r) => {
      return `
        <button
          type="button"
          data-resource-id="${r.id}"
          class="w-full text-left rounded-2xl border border-black/10 bg-white px-4 py-3 transition hover:bg-black/5"
          title="Select resource"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold truncate">
                <p>${r.note ?? ""}</p>
              </div>
              <div class="inline-block justify-center flex text-center p-1 rounded-md
              bg-${r.status == "active" ? "green" : r.status == "cancelled" ? "red" : "yellow"}-600">
                  <span class="text-xs text-black/50">
                      ${r.status ?? ""}
                  </span>
              </div>
              <input type="datetime-local" value="${(r.start_time ?? "").slice(0, 16)}" class="mt-3 w-full max-w-[280px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none
                  focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30
                  transition-all duration-200 ease-out" readonly="" />
              <input type="datetime-local" value="${(r.end_time ?? "").slice(0, 16)}" class="mt-2 w-full max-w-[280px] rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none
                  focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30
                  transition-all duration-200 ease-out" readonly="" />
            </div>
          </div>
        </button>
      `;
    })
    .join("");

  // Wire selection clicks
  resourceListEl.querySelectorAll("[data-resource-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearFormMessage();
      const id = Number(btn.dataset.resourceId);
      const resource = reservationCache.find((x) => Number(x.id) === id);
      if (!resource) return;
      selectResource(resource);
    });
  });
};

function selectResource(resource) {
  originalState = resource;
  selectedReservationId = Number(resource.id);
  if (reservationIdInput) reservationIdInput.value = String(resource.id);

  reservationNoteInput.value = resource.note ?? "";
  reservationNoteInput.dispatchEvent(new Event("input", { bubbles: true }));

  const unit = resource.status ?? "active";
  const unitRadio = document.querySelector(`input[name="reservationStatus"][value="${unit}"]`);
  if (unitRadio) unitRadio.checked = true;

  document.getElementById("userId").value = resource.user_id;
  document.getElementById("resourceId").value = resource.resource_id;

  reservationStart.value = resource.start_time.slice(0, 16);
  reservationEnd.value = resource.end_time.slice(0, 16);

  reservationStart.dispatchEvent(new Event("input", { bubbles: true }));
  reservationEnd.dispatchEvent(new Event("input", { bubbles: true }));

  
  // Switch to edit mode
  formMode = "edit";
  renderActionButtons(role);
  highlightSelectedResource(resource.id);

  attachStateListeners();
}

function highlightSelectedResource(id) {
  if (!resourceListEl) return;
  const items = resourceListEl.querySelectorAll("[data-resource-id]");
  items.forEach((el) => {
    const thisId = Number(el.dataset.resourceId);
    const isSelected = id && thisId === Number(id);
    el.classList.toggle("ring-2", isSelected);
    el.classList.toggle("ring-brand-blue/40", isSelected);
    el.classList.toggle("bg-brand-blue/5", isSelected);
  });
}

function updateDropdown() {
  const select = document.getElementById("resourceId");
  while (select.hasChildNodes())
    select.removeChild(select.lastChild);
  resourcesCache.forEach((res, index, array) => {
      const opt = document.createElement("option");
      opt.value = res.id;
      opt.textContent = res.name;
      select.appendChild(opt)
  });
}

async function loadResources() {
  try {
    const res = await fetch("/api/reservations");
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Failed to load reservations:", res.status, body);
      renderResourceList([]);
      return;
    }

    reservationCache = Array.isArray(body.data) ? body.data : [];
    renderResourceList(reservationCache);

    // If we still have an ID selected, keep it selected after refresh
    const idNow = reservationIdInput?.value ? Number(reservationIdInput.value) : null;
    if (idNow) {
      const found = reservationCache.find((x) => Number(x.id) === idNow);
      if (found) selectResource(found);
    }
  } catch (err) {
    console.error("Failed to load reservation:", err);
    renderResourceList([]);
  }
  try {
    const res = await fetch("/api/resources");
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("Failed to load resources:", res.status, body);
      return;
    }

    resourcesCache = Array.isArray(body.data) ? body.data : [];
  } catch (err) {
    console.error("Failed to load resources:", err);
  }
  updateDropdown();
}

// ===============================
// 4) Bootstrapping
// ===============================
renderActionButtons(role);

const reservationNoteInput = createReservationNoteInput(resourceNameCnt);
attachReservationNoteValidation(reservationNoteInput);
attachReservationStartValidation(reservationStart);
attachReservationEndValidation(reservationEnd, reservationStart);

// From form.js
window.onResourceActionSuccess = async ({ action }) => {
  if (action === "delete" || action === "create" || action === "update") {
    setCurrentResourceId(null);
    selectedReservationId = null;
    formMode = "create";
    clearResourceForm();
  }
  await loadResources();
  renderActionButtons(role);
};

loadResources();