
// ===============================
// Form handling for resources page
// ===============================

// -------------- Helpers --------------
function $(id) {
  return document.getElementById(id);
}

function logSection(title, data) {
  console.group(title);
  console.log(data);
  console.groupEnd();
}

// -------------- Form wiring --------------
document.addEventListener("DOMContentLoaded", () => {
  const form = $("resourceForm");
  if (!form) {
    console.warn("resourceForm not found. Ensure the form has id=\"resourceForm\".");
    return;
  }

  form.addEventListener("submit", onSubmit);
});

function isResourceNameValid(value) {
  const trimmed = value.trim();

  // Allowed: letters, numbers, Finnish letters, and space (based on your current regex)
  const allowedPattern = /^[a-zA-Z0-9äöåÄÖÅ ]+$/;

  const lengthValid = trimmed.length >= 5 && trimmed.length <= 30;
  const charactersValid = allowedPattern.test(trimmed);

  return lengthValid && charactersValid;
}

function isResourceDescriptionValid(value) {
  const trimmed = value.trim();

  // Allowed: letters, numbers, Finnish letters, and space (based on your current regex)
  const allowedPattern = /^[a-zA-Z0-9äöåÄÖÅ ]+$/;

  const lengthValid = trimmed.length >= 10 && trimmed.length <= 30;
  const charactersValid = allowedPattern.test(trimmed);

  return lengthValid && charactersValid;
}


async function onSubmit(event) {
  event.preventDefault();
  const submitter = event.submitter;
  const actionValue = submitter && submitter.value ? submitter.value : "create";

  const resourceName = $("resourceName")?.value.trim() ?? "";
  if (!isResourceNameValid(resourceName)) {
    console.warn("Tried to submit invalid form: resource name")
    return;
  }

  const resourceDescription = $("resourceDescription")?.value.trim() ?? "";
  if (!isResourceDescriptionValid(resourceDescription)) {
    console.warn("Tried to submit invalid form: resource description")
    return;
  }
  
  const resourcePrice = $("resourcePrice")?.value.trim() ?? "0";
  //Resource price unit was always empty for some reason ?
  //Taken from: https://stackoverflow.com/questions/15839169/how-to-get-the-value-of-a-selected-radio-button
  const resourcePriceUnit = document.querySelector('input[name="resourcePriceUnit"]:checked')?.value ?? "";

  const payload = {
    action: actionValue,
    resourceName: resourceName,
    resourceDescription: resourceDescription,
    resourceAvailable: $("resourceAvailable")?.value ?? "off",
    resourcePrice: resourcePrice === "" ? "0" : resourcePrice,
    resourcePriceUnit: resourcePriceUnit
  };

  logSection("Sending payload to httpbin.org/post", payload);

  try {
    const response = await fetch("https://httpbin.org/post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}\n${text}`);
    }

    const data = await response.json();

    console.group("Response from httpbin.org");
    console.log("Status:", response.status);
    console.log("URL:", data.url);
    console.log("You sent (echo):", data.json);
    console.log("Headers (echoed):", data.headers);
    console.groupEnd();

  } catch (err) {
    console.error("POST error:", err);
  }
}