import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const loginPanel = document.querySelector("#login-panel");
const inboxPanel = document.querySelector("#inbox-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const inboxMessage = document.querySelector("#inbox-message");
const rowsElement = document.querySelector("#inquiry-rows");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");
const pageSize = 25;
let supabase;
let currentPage = 0;
let totalInquiries = 0;

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.dataset.state = isError ? "error" : "success";
}

function showLogin() {
  inboxPanel.hidden = true;
  loginPanel.hidden = false;
}

function showInbox() {
  loginPanel.hidden = true;
  inboxPanel.hidden = false;
}

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = busy;
}

function addCell(row, content, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.append(content);
  row.append(cell);
  return cell;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function loadStats() {
  const statuses = ["new", "in_progress", "resolved"];
  const [allResult, ...statusResults] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }),
    ...statuses.map((status) =>
      supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", status),
    ),
  ]);
  const errors = [allResult, ...statusResults].filter((result) => result.error);
  if (errors.length) throw errors[0].error;

  document.querySelector("#total-count").textContent = allResult.count ?? 0;
  document.querySelector("#new-count").textContent = statusResults[0].count ?? 0;
  document.querySelector("#progress-count").textContent = statusResults[1].count ?? 0;
  document.querySelector("#resolved-count").textContent = statusResults[2].count ?? 0;
}

function renderInquiry(inquiry) {
  const row = document.createElement("tr");
  const details = document.createElement("div");
  details.className = "inquiry-person";

  const name = document.createElement("strong");
  name.textContent = inquiry.name;
  details.append(name);

  const email = document.createElement("a");
  email.href = `mailto:${inquiry.email}`;
  email.textContent = inquiry.email;
  details.append(email);

  if (inquiry.phone) {
    const phone = document.createElement("a");
    phone.href = `tel:${inquiry.phone}`;
    phone.textContent = inquiry.phone;
    details.append(phone);
  }

  const message = document.createElement("p");
  message.textContent = inquiry.message;
  details.append(message);
  addCell(row, details, "inquiry-person-cell");

  const received = document.createElement("span");
  received.textContent = formatDate(inquiry.created_at);
  addCell(row, received);

  const statusSelect = document.createElement("select");
  statusSelect.className = "status-select";
  statusSelect.setAttribute("aria-label", `Status for ${inquiry.name}`);
  [
    ["new", "New"],
    ["in_progress", "In progress"],
    ["resolved", "Resolved"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = inquiry.status === value;
    statusSelect.append(option);
  });
  statusSelect.addEventListener("change", async () => {
    statusSelect.disabled = true;
    try {
      const { error } = await supabase
        .from("inquiries")
        .update({ status: statusSelect.value })
        .eq("id", inquiry.id);
      if (error) throw error;
      inquiry.status = statusSelect.value;
      setMessage(inboxMessage, "Inquiry status updated.");
      await refreshDashboard();
    } catch (error) {
      console.error("Could not update inquiry status:", error.message);
      setMessage(inboxMessage, "Status update failed. Please refresh and try again.", true);
      statusSelect.value = inquiry.status;
    } finally {
      statusSelect.disabled = false;
    }
  });
  addCell(row, statusSelect);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete inquiry from ${inquiry.name}`);
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Permanently delete the inquiry from ${inquiry.name}?`)) return;
    deleteButton.disabled = true;
    try {
      const { error } = await supabase.from("inquiries").delete().eq("id", inquiry.id);
      if (error) throw error;
      setMessage(inboxMessage, "Inquiry deleted.");
      await refreshDashboard();
    } catch (error) {
      console.error("Could not delete inquiry:", error.message);
      setMessage(inboxMessage, "Delete failed. Please refresh and try again.", true);
    } finally {
      deleteButton.disabled = false;
    }
  });
  addCell(row, deleteButton);
  return row;
}

async function loadInquiries() {
  const from = currentPage * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("inquiries")
    .select("id, name, email, phone, message, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const selectedStatus = statusFilter.value;
  if (selectedStatus !== "all") query = query.eq("status", selectedStatus);

  const { data, error, count } = await query;
  if (error) throw error;

  totalInquiries = count ?? 0;
  const search = searchInput.value.trim().toLocaleLowerCase();
  const visibleInquiries = (data ?? []).filter((inquiry) =>
    [inquiry.name, inquiry.email, inquiry.phone, inquiry.message]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(search)),
  );

  rowsElement.replaceChildren(...visibleInquiries.map(renderInquiry));
  document.querySelector("#empty-state").hidden = visibleInquiries.length > 0;

  const totalPages = Math.ceil(totalInquiries / pageSize);
  document.querySelector("#page-summary").textContent =
    totalInquiries === 0
      ? "No inquiries"
      : `Page ${currentPage + 1} of ${totalPages} · ${totalInquiries} total`;
  document.querySelector("#previous-page").disabled = currentPage === 0;
  document.querySelector("#next-page").disabled = currentPage + 1 >= totalPages;
}

async function refreshDashboard() {
  inboxMessage.textContent = "";
  try {
    await Promise.all([loadStats(), loadInquiries()]);
  } catch (error) {
    console.error("Could not load inquiry dashboard:", error.message);
    setMessage(
      inboxMessage,
      "Could not load inquiries. Check your connection and Supabase policies, then try again.",
      true,
    );
  }
}

function registerDashboardControls() {
  document.querySelector("#refresh-inquiries").addEventListener("click", refreshDashboard);
  document.querySelector("#previous-page").addEventListener("click", async () => {
    currentPage = Math.max(0, currentPage - 1);
    await refreshDashboard();
  });
  document.querySelector("#next-page").addEventListener("click", async () => {
    currentPage += 1;
    await refreshDashboard();
  });
  statusFilter.addEventListener("change", async () => {
    currentPage = 0;
    await refreshDashboard();
  });
  searchInput.addEventListener("input", async () => {
    currentPage = 0;
    await refreshDashboard();
  });
  document.querySelector("#sign-out").addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Could not sign out:", error.message);
      setMessage(inboxMessage, "Sign out failed. Please try again.", true);
    }
  });
}

const isConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

if (!isConfigured) {
  setMessage(
    loginMessage,
    "Add your Supabase project URL and publishable/anon key to supabase-config.js first.",
    true,
  );
  loginForm.querySelector('button[type="submit"]').disabled = true;
} else {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    registerDashboardControls();

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!loginForm.reportValidity()) return;
      setBusy(loginForm, true);
      setMessage(loginMessage, "Signing in…");

      const fields = new FormData(loginForm);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: String(fields.get("email")).trim(),
          password: String(fields.get("password")),
        });
        if (error) throw error;
        setMessage(loginMessage, "");
      } catch (error) {
        console.error("Dashboard sign-in failed:", error.message);
        setMessage(loginMessage, "Sign-in failed. Check your email and password.", true);
      } finally {
        setBusy(loginForm, false);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        showLogin();
        return;
      }
      showInbox();
      window.setTimeout(refreshDashboard, 0);
    });
  } catch (error) {
    console.error("Could not load the dashboard client:", error.message);
    setMessage(loginMessage, "The dashboard could not connect. Check your internet connection and reload.", true);
    loginForm.querySelector('button[type="submit"]').disabled = true;
  }
}
