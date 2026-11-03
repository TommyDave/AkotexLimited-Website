import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const form = document.querySelector("#inquiry-form");
const status = document.querySelector("#form-status");
const submitButton = form.querySelector('button[type="submit"]');
const isConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

if (!isConfigured) {
  status.textContent = "The inquiry form is not set up yet. Please call us instead.";
  status.dataset.state = "error";
  submitButton.disabled = true;
} else {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const fields = new FormData(form);
      if (String(fields.get("website") || "").trim()) {
        form.reset();
        status.textContent = "Thank you. Your inquiry has been received.";
        status.dataset.state = "success";
        return;
      }

      submitButton.disabled = true;
      status.textContent = "Sending your inquiry…";
      status.dataset.state = "pending";

      try {
        const { error } = await supabase.from("inquiries").insert({
          name: String(fields.get("name")).trim(),
          email: String(fields.get("email")).trim(),
          phone: String(fields.get("phone") || "").trim() || null,
          message: String(fields.get("message")).trim(),
        });
        if (error) throw error;

        form.reset();
        status.textContent = "Thank you. Your inquiry has been received.";
        status.dataset.state = "success";
      } catch (error) {
        console.error("Could not submit inquiry:", error.message);
        status.textContent = "We couldn’t send your inquiry. Please try again or call us.";
        status.dataset.state = "error";
      } finally {
        submitButton.disabled = false;
      }
    });
  } catch (error) {
    console.error("Could not load the inquiry form client:", error.message);
    status.textContent = "The inquiry form could not connect. Please call us instead.";
    status.dataset.state = "error";
    submitButton.disabled = true;
  }
}
