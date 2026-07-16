const STORAGE_KEY = "home-stock-items-v1";
const CHECKED_KEY = "home-stock-checked-v1";
const CATEGORIES_KEY = "home-stock-categories-v1";

const defaultCategories = ["日常消耗品", "清潔用品", "盥洗用品", "衣物備品", "食品", "其他"];
const availableEmojis = [
  "🧻", "🧴", "🧼", "🪥", "🦷", "🪒", "🧽", "🧹",
  "🪣", "🧺", "🧦", "🩲", "👕", "👖", "👚", "👟",
  "🥿", "🧤", "🧢", "🛏️", "🛁", "🚽", "💊", "🩹",
  "🍚", "🍞", "🥛", "🥚", "🥫", "🍜", "☕", "🧂",
  "🍼", "👶", "🐶", "🐱", "🐾", "🔋", "💡", "🕯️",
  "🗑️", "🛍️", "📦", "✏️", "📒", "🧰", "🔧", "🪴",
];

const starterItems = [
  {
    id: "paper",
    name: "抽取式衛生紙",
    category: "日常消耗品",
    emoji: "🧻",
    quantity: 2,
    unit: "包",
    minimum: 3,
    location: "儲藏室",
    note: "",
    updatedAt: Date.now() - 1000,
  },
  {
    id: "shampoo",
    name: "洗髮精",
    category: "盥洗用品",
    emoji: "🧴",
    quantity: 1,
    unit: "瓶",
    minimum: 1,
    location: "浴室櫃",
    note: "補充包也算一瓶",
    updatedAt: Date.now() - 2000,
  },
  {
    id: "socks",
    name: "爸爸黑襪",
    category: "衣物備品",
    emoji: "🧦",
    quantity: 5,
    unit: "雙",
    minimum: 3,
    location: "主臥衣櫃",
    note: "黑色／L",
    updatedAt: Date.now() - 3000,
  },
  {
    id: "underwear",
    name: "小明新內褲",
    category: "衣物備品",
    emoji: "🩲",
    quantity: 3,
    unit: "件",
    minimum: 2,
    location: "小明衣櫃",
    note: "藍色／120",
    updatedAt: Date.now() - 4000,
  },
  {
    id: "detergent",
    name: "洗衣精",
    category: "清潔用品",
    emoji: "🧴",
    quantity: 2,
    unit: "瓶",
    minimum: 1,
    location: "陽台",
    note: "",
    updatedAt: Date.now() - 5000,
  },
];

let items = loadJson(STORAGE_KEY, starterItems);
let checkedItems = new Set(loadJson(CHECKED_KEY, []));
let categories = loadJson(CATEGORIES_KEY, [
  ...new Set([...defaultCategories, ...items.map((item) => item.category)]),
]);
categories = [
  ...new Set([
    ...(Array.isArray(categories) ? categories : defaultCategories),
    ...items.map((item) => item.category),
    "其他",
  ].filter(Boolean)),
];
let activeCategory = "全部";
let activeDetailItemId = null;
let deferredInstallPrompt = null;
let toastTimer = null;

const elements = {
  totalCount: document.querySelector("#total-count"),
  lowCount: document.querySelector("#low-count"),
  lowStockList: document.querySelector("#low-stock-list"),
  recentList: document.querySelector("#recent-list"),
  inventoryList: document.querySelector("#inventory-list"),
  shoppingList: document.querySelector("#shopping-list"),
  shoppingProgressText: document.querySelector("#shopping-progress-text"),
  shoppingProgressBar: document.querySelector("#shopping-progress-bar"),
  categoryChips: document.querySelector("#category-chips"),
  searchInput: document.querySelector("#search-input"),
  itemModal: document.querySelector("#item-modal"),
  detailModal: document.querySelector("#detail-modal"),
  categoryModal: document.querySelector("#category-modal"),
  itemForm: document.querySelector("#item-form"),
  modalTitle: document.querySelector("#modal-title"),
  deleteButton: document.querySelector("#delete-button"),
  toast: document.querySelector("#toast"),
  installButton: document.querySelector("#install-button"),
  itemCategory: document.querySelector("#item-category"),
  itemEmoji: document.querySelector("#item-emoji"),
  emojiPicker: document.querySelector("#emoji-picker"),
  emojiPickerField: document.querySelector("#emoji-picker-field"),
  toggleEmojiPicker: document.querySelector("#toggle-emoji-picker"),
  selectedEmoji: document.querySelector("#selected-emoji"),
  categoryManagerList: document.querySelector("#category-manager-list"),
  variantList: document.querySelector("#variant-list"),
  itemQuantity: document.querySelector("#item-quantity"),
};

function loadJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function saveChecked() {
  localStorage.setItem(CHECKED_KEY, JSON.stringify([...checkedItems]));
}

function saveCategories() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

function isLow(item) {
  return totalQuantity(item) <= item.minimum;
}

function hasVariants(item) {
  return Array.isArray(item.variants) && item.variants.length > 0;
}

function totalQuantity(item) {
  return hasVariants(item)
    ? item.variants.reduce((total, variant) => total + Math.max(0, Number(variant.quantity) || 0), 0)
    : Math.max(0, Number(item.quantity) || 0);
}

function syncItemQuantity(item) {
  item.quantity = totalQuantity(item);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemCard(item) {
  const low = isLow(item);
  const total = totalQuantity(item);
  const grouped = hasVariants(item);
  const detail = [item.location, item.note].filter(Boolean).join(" · ");
  return `
    <article class="item-card ${low ? "is-low" : ""}" data-id="${escapeHtml(item.id)}">
      <div class="item-emoji" aria-hidden="true">${escapeHtml(item.emoji)}</div>
      <div class="item-main" data-action="detail" tabindex="0" role="button" aria-label="查看 ${escapeHtml(item.name)}細分庫存">
        <div class="item-title-row">
          <span class="item-title">${escapeHtml(item.name)}</span>
          ${low ? '<span class="status-dot" title="需要補貨"></span>' : ""}
        </div>
        <p class="item-meta">${grouped ? `${item.variants.length} 種細分 · ` : ""}${escapeHtml(detail || item.category)}</p>
      </div>
      ${
        grouped
          ? `<div class="group-total" data-action="detail" role="button" aria-label="查看細分">
              <div class="quantity"><strong>${total}</strong><span>${escapeHtml(item.unit)}</span></div>
              <span class="group-chevron" aria-hidden="true">›</span>
            </div>`
          : `<div class="stepper" aria-label="${escapeHtml(item.name)}數量">
              <button type="button" data-action="decrease" aria-label="減少一${escapeHtml(item.unit)}">−</button>
              <div class="quantity"><strong>${total}</strong><span>${escapeHtml(item.unit)}</span></div>
              <button type="button" data-action="increase" aria-label="增加一${escapeHtml(item.unit)}">＋</button>
            </div>`
      }
    </article>
  `;
}

function renderEmpty(title = "目前都很充足", description = "庫存不足的用品會顯示在這裡。") {
  return `
    <div class="empty-state">
      <div class="empty-icon">✓</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function renderHome() {
  const lowItems = items.filter(isLow).sort((a, b) => totalQuantity(a) - totalQuantity(b));
  const recentItems = [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  elements.totalCount.textContent = items.length;
  elements.lowCount.textContent = lowItems.length;
  elements.lowStockList.innerHTML = lowItems.length
    ? lowItems.slice(0, 3).map(itemCard).join("")
    : renderEmpty();
  elements.recentList.innerHTML = recentItems.length
    ? recentItems.map(itemCard).join("")
    : renderEmpty("還沒有用品", "點右下角的加號建立第一筆庫存。");
}

function renderCategories() {
  const filterCategories = ["全部", ...categories];
  if (!filterCategories.includes(activeCategory)) activeCategory = "全部";
  elements.categoryChips.innerHTML = filterCategories
    .map(
      (category) => `
        <button class="chip ${category === activeCategory ? "active" : ""}" type="button" data-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `,
    )
    .join("");
}

function renderCategoryOptions(selected = elements.itemCategory.value) {
  elements.itemCategory.innerHTML = categories
    .map(
      (category) =>
        `<option value="${escapeHtml(category)}"${category === selected ? " selected" : ""}>${escapeHtml(category)}</option>`,
    )
    .join("");
}

function renderEmojiPicker(selected = elements.itemEmoji.value || "📦") {
  if (!availableEmojis.includes(selected)) availableEmojis.unshift(selected);
  elements.itemEmoji.value = selected;
  elements.selectedEmoji.textContent = selected;
  elements.emojiPicker.innerHTML = availableEmojis
    .map(
      (emoji) => `
        <button class="emoji-option ${emoji === selected ? "selected" : ""}" type="button"
          data-emoji="${escapeHtml(emoji)}" role="option" aria-selected="${emoji === selected}"
          aria-label="選擇 ${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>
      `,
    )
    .join("");
}

function setEmojiPickerOpen(open) {
  elements.emojiPickerField.hidden = !open;
  elements.toggleEmojiPicker.setAttribute("aria-expanded", String(open));
}

function renderCategoryManager() {
  elements.categoryManagerList.innerHTML = categories
    .map(
      (category) => `
        <div class="category-row" data-category="${escapeHtml(category)}">
          <input value="${escapeHtml(category)}" maxlength="20" aria-label="分類名稱：${escapeHtml(category)}" />
          <button class="category-delete" type="button" data-action="delete-category"
            ${category === "其他" ? "disabled" : ""} aria-label="刪除 ${escapeHtml(category)}">×</button>
        </div>
      `,
    )
    .join("");
}

function renderInventory() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase("zh-Hant");
  const filtered = items
    .filter((item) => activeCategory === "全部" || item.category === activeCategory)
    .filter((item) =>
      [item.name, item.category, item.location, item.note]
        .join(" ")
        .toLocaleLowerCase("zh-Hant")
        .includes(query),
    )
    .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || b.updatedAt - a.updatedAt);
  elements.inventoryList.innerHTML = filtered.length
    ? filtered.map(itemCard).join("")
    : renderEmpty("找不到用品", "試試其他關鍵字或分類。");
}

function renderShopping() {
  const shoppingItems = items.filter(isLow).sort((a, b) => totalQuantity(a) - totalQuantity(b));
  for (const id of checkedItems) {
    if (!shoppingItems.some((item) => item.id === id)) checkedItems.delete(id);
  }
  saveChecked();

  const checkedCount = shoppingItems.filter((item) => checkedItems.has(item.id)).length;
  const progress = shoppingItems.length ? (checkedCount / shoppingItems.length) * 100 : 0;
  elements.shoppingProgressText.textContent = shoppingItems.length
    ? `已完成 ${checkedCount}／${shoppingItems.length} 項`
    : "尚無待購項目";
  elements.shoppingProgressBar.style.width = `${progress}%`;
  elements.shoppingList.innerHTML = shoppingItems.length
    ? shoppingItems
        .map(
          (item) => `
            <article class="shopping-card ${checkedItems.has(item.id) ? "checked" : ""}" data-id="${escapeHtml(item.id)}">
              <button class="check-button" type="button" data-action="check" aria-label="標記${escapeHtml(item.name)}">${checkedItems.has(item.id) ? "✓" : ""}</button>
              <div class="item-emoji" aria-hidden="true">${escapeHtml(item.emoji)}</div>
              <div class="shopping-copy">
                <h3>${escapeHtml(item.name)}</h3>
                <p>剩 ${totalQuantity(item)} ${escapeHtml(item.unit)} · 建議至少 ${item.minimum + 1} ${escapeHtml(item.unit)}</p>
              </div>
              <button class="restock-button" type="button" data-action="${hasVariants(item) ? "detail" : "restock"}">${hasVariants(item) ? "查看細分" : "已補貨"}</button>
            </article>
          `,
        )
        .join("")
    : renderEmpty("採購清單是空的", "家中用品目前都高於最低庫存。");
}

function renderAll() {
  renderHome();
  renderCategories();
  renderCategoryOptions();
  renderInventory();
  renderShopping();
}

function updateQuantity(id, difference) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item || hasVariants(item)) return;
  const next = Math.max(0, totalQuantity(item) + difference);
  if (next === item.quantity) {
    showToast("數量已經是 0");
    return;
  }
  item.quantity = next;
  item.updatedAt = Date.now();
  if (!isLow(item)) checkedItems.delete(item.id);
  saveItems();
  saveChecked();
  renderAll();
  showToast(`${item.name}：${item.quantity} ${item.unit}`);
}

function handleCardAction(event) {
  const actionTarget = event.target.closest("[data-action]");
  const card = event.target.closest("[data-id]");
  if (!actionTarget || !card) return;
  const { action } = actionTarget.dataset;
  const { id } = card.dataset;
  if (action === "increase") updateQuantity(id, 1);
  if (action === "decrease") updateQuantity(id, -1);
  if (action === "detail") openDetailModal(id);
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}-view`);
  });
  document.querySelectorAll(".nav-item").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openItemModal(id = null) {
  elements.itemForm.reset();
  renderCategoryOptions(categories[0]);
  renderEmojiPicker("📦");
  setEmojiPickerOpen(false);
  document.querySelector("#item-id").value = id || "";
  document.querySelector("#item-quantity").value = 1;
  document.querySelector("#item-minimum").value = 1;
  elements.modalTitle.textContent = id ? "編輯用品" : "新增用品";
  elements.deleteButton.hidden = !id;
  elements.itemQuantity.disabled = false;

  if (id) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    document.querySelector("#item-name").value = item.name;
    renderCategoryOptions(item.category);
    renderEmojiPicker(item.emoji);
    elements.itemQuantity.value = totalQuantity(item);
    elements.itemQuantity.disabled = hasVariants(item);
    elements.itemQuantity.title = hasVariants(item) ? "有細分庫存時，請在細分畫面調整數量" : "";
    document.querySelector("#item-unit").value = item.unit;
    document.querySelector("#item-minimum").value = item.minimum;
    document.querySelector("#item-location").value = item.location;
    document.querySelector("#item-note").value = item.note;
  }

  elements.itemModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeItemModal() {
  elements.itemModal.hidden = true;
  document.body.style.overflow = "";
}

function renderVariantList(item) {
  document.querySelector("#detail-emoji").textContent = item.emoji;
  document.querySelector("#detail-category").textContent = item.category;
  document.querySelector("#detail-title").textContent = item.name;
  document.querySelector("#detail-total").textContent = totalQuantity(item);
  document.querySelector("#detail-unit").textContent = item.unit;
  elements.variantList.innerHTML = hasVariants(item)
    ? item.variants
        .map(
          (variant) => `
            <div class="variant-row" data-variant-id="${escapeHtml(variant.id)}">
              <input class="variant-name" value="${escapeHtml(variant.name)}" maxlength="24"
                aria-label="細分名稱：${escapeHtml(variant.name)}" />
              <div class="variant-stepper" aria-label="${escapeHtml(variant.name)}數量">
                <button type="button" data-action="variant-decrease" aria-label="減少">−</button>
                <strong>${Math.max(0, Number(variant.quantity) || 0)}</strong>
                <button type="button" data-action="variant-increase" aria-label="增加">＋</button>
              </div>
              <button class="variant-delete" type="button" data-action="variant-delete" aria-label="刪除此細分">×</button>
            </div>
          `,
        )
        .join("")
    : '<div class="variants-empty">尚未建立細分，目前數量可直接在清單調整。</div>';
}

function openDetailModal(id) {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) return;
  activeDetailItemId = id;
  renderVariantList(item);
  document.querySelector("#variant-add-form").reset();
  document.querySelector("#variant-quantity").value = 1;
  elements.detailModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDetailModal() {
  elements.detailModal.hidden = true;
  activeDetailItemId = null;
  document.body.style.overflow = "";
}

function addVariant(event) {
  event.preventDefault();
  const item = items.find((candidate) => candidate.id === activeDetailItemId);
  if (!item) return;
  const nameInput = document.querySelector("#variant-name");
  const quantityInput = document.querySelector("#variant-quantity");
  const name = nameInput.value.trim();
  const quantity = Math.max(0, Number.parseInt(quantityInput.value, 10) || 0);
  if (!name) return;
  if (!hasVariants(item)) {
    item.variants = [
      {
        id: `${Date.now()}-original`,
        name: "未分類",
        quantity: Math.max(0, Number(item.quantity) || 0),
      },
    ];
  }
  item.variants.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    quantity,
  });
  syncItemQuantity(item);
  item.updatedAt = Date.now();
  saveItems();
  renderAll();
  renderVariantList(item);
  nameInput.value = "";
  quantityInput.value = 1;
  showToast(`已新增「${name}」`);
}

function updateVariant(item, variantId, difference) {
  const variant = item.variants.find((candidate) => candidate.id === variantId);
  if (!variant) return;
  variant.quantity = Math.max(0, (Number(variant.quantity) || 0) + difference);
  syncItemQuantity(item);
  item.updatedAt = Date.now();
  if (!isLow(item)) checkedItems.delete(item.id);
  saveItems();
  saveChecked();
  renderAll();
  renderVariantList(item);
}

function renameVariant(item, variantId, name) {
  const variant = item.variants.find((candidate) => candidate.id === variantId);
  const cleanName = name.trim();
  if (!variant || !cleanName) {
    renderVariantList(item);
    return;
  }
  variant.name = cleanName;
  item.updatedAt = Date.now();
  saveItems();
  renderAll();
  renderVariantList(item);
}

function deleteVariant(item, variantId) {
  const variant = item.variants.find((candidate) => candidate.id === variantId);
  if (!variant || !window.confirm(`確定要刪除「${variant.name}」嗎？`)) return;
  item.variants = item.variants.filter((candidate) => candidate.id !== variantId);
  if (item.variants.length === 0) {
    delete item.variants;
    item.quantity = 0;
  } else {
    syncItemQuantity(item);
  }
  item.updatedAt = Date.now();
  saveItems();
  renderAll();
  renderVariantList(item);
  showToast("細分已刪除");
}

function openCategoryModal() {
  renderCategoryManager();
  elements.categoryModal.hidden = false;
  document.querySelector("#new-category-name").value = "";
}

function closeCategoryModal() {
  elements.categoryModal.hidden = true;
  renderCategoryOptions(elements.itemCategory.value);
}

function addCategory(event) {
  event.preventDefault();
  const input = document.querySelector("#new-category-name");
  const name = input.value.trim();
  if (!name) return;
  if (categories.includes(name)) {
    showToast("這個分類已經存在");
    input.select();
    return;
  }
  categories.push(name);
  saveCategories();
  renderCategoryManager();
  renderCategories();
  renderCategoryOptions(name);
  input.value = "";
  input.focus();
  showToast(`已新增「${name}」`);
}

function renameCategory(oldName, newName) {
  const cleanName = newName.trim();
  if (!cleanName || cleanName === oldName) {
    renderCategoryManager();
    return;
  }
  if (categories.includes(cleanName)) {
    showToast("這個分類已經存在");
    renderCategoryManager();
    return;
  }
  categories = categories.map((category) => (category === oldName ? cleanName : category));
  items.forEach((item) => {
    if (item.category === oldName) item.category = cleanName;
  });
  if (activeCategory === oldName) activeCategory = cleanName;
  saveCategories();
  saveItems();
  renderAll();
  renderCategoryManager();
  showToast(`已改名為「${cleanName}」`);
}

function deleteCategory(name) {
  if (name === "其他") return;
  const usedCount = items.filter((item) => item.category === name).length;
  const message = usedCount
    ? `「${name}」中有 ${usedCount} 項用品，刪除後會移到「其他」。確定刪除嗎？`
    : `確定要刪除分類「${name}」嗎？`;
  if (!window.confirm(message)) return;
  if (!categories.includes("其他")) categories.push("其他");
  categories = categories.filter((category) => category !== name);
  items.forEach((item) => {
    if (item.category === name) item.category = "其他";
  });
  if (activeCategory === name) activeCategory = "全部";
  saveCategories();
  saveItems();
  renderAll();
  renderCategoryManager();
  showToast("分類已刪除");
}

function submitItem(event) {
  event.preventDefault();
  const id = document.querySelector("#item-id").value;
  const existingItem = id ? items.find((item) => item.id === id) : null;
  const data = {
    id: id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: document.querySelector("#item-name").value.trim(),
    category: elements.itemCategory.value,
    emoji: elements.itemEmoji.value,
    quantity: existingItem && hasVariants(existingItem)
      ? totalQuantity(existingItem)
      : Math.max(0, Number.parseInt(elements.itemQuantity.value, 10) || 0),
    unit: document.querySelector("#item-unit").value,
    minimum: Math.max(0, Number.parseInt(document.querySelector("#item-minimum").value, 10) || 0),
    location: document.querySelector("#item-location").value.trim(),
    note: document.querySelector("#item-note").value.trim(),
    updatedAt: Date.now(),
  };
  if (existingItem && hasVariants(existingItem)) data.variants = existingItem.variants;

  if (id) {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) items[index] = data;
  } else {
    items.unshift(data);
  }
  if (!isLow(data)) checkedItems.delete(data.id);
  saveItems();
  saveChecked();
  renderAll();
  closeItemModal();
  showToast(id ? "用品已更新" : "用品已新增");
}

function deleteCurrentItem() {
  const id = document.querySelector("#item-id").value;
  const item = items.find((candidate) => candidate.id === id);
  if (!item || !window.confirm(`確定要刪除「${item.name}」嗎？`)) return;
  items = items.filter((candidate) => candidate.id !== id);
  checkedItems.delete(id);
  saveItems();
  saveChecked();
  renderAll();
  closeItemModal();
  showToast("用品已刪除");
}

function handleShoppingAction(event) {
  const target = event.target.closest("[data-action]");
  const card = event.target.closest("[data-id]");
  if (!target || !card) return;
  const item = items.find((candidate) => candidate.id === card.dataset.id);
  if (!item) return;
  if (target.dataset.action === "detail") {
    openDetailModal(item.id);
  }
  if (target.dataset.action === "check") {
    checkedItems.has(item.id) ? checkedItems.delete(item.id) : checkedItems.add(item.id);
    saveChecked();
    renderShopping();
  }
  if (target.dataset.action === "restock") {
    item.quantity = Math.max(item.quantity, item.minimum + 1);
    item.updatedAt = Date.now();
    checkedItems.delete(item.id);
    saveItems();
    saveChecked();
    renderAll();
    showToast(`${item.name} 已補到 ${item.quantity} ${item.unit}`);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("zh-TW", {
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(new Date());

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.go));
});

document.querySelector("#add-button").addEventListener("click", () => openItemModal());
document.querySelector("#close-modal").addEventListener("click", closeItemModal);
document.querySelector("#close-detail-modal").addEventListener("click", closeDetailModal);
document.querySelector("#variant-add-form").addEventListener("submit", addVariant);
document.querySelector("#edit-detail-item").addEventListener("click", () => {
  const id = activeDetailItemId;
  closeDetailModal();
  openItemModal(id);
});
document.querySelector("#manage-categories-button").addEventListener("click", openCategoryModal);
document.querySelector("#close-category-modal").addEventListener("click", closeCategoryModal);
document.querySelector("#category-add-form").addEventListener("submit", addCategory);
elements.toggleEmojiPicker.addEventListener("click", () => {
  setEmojiPickerOpen(elements.emojiPickerField.hidden);
});
elements.itemModal.addEventListener("click", (event) => {
  if (event.target === elements.itemModal) closeItemModal();
});
elements.detailModal.addEventListener("click", (event) => {
  if (event.target === elements.detailModal) closeDetailModal();
});
elements.categoryModal.addEventListener("click", (event) => {
  if (event.target === elements.categoryModal) closeCategoryModal();
});
elements.emojiPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-emoji]");
  if (!button) return;
  renderEmojiPicker(button.dataset.emoji);
  setEmojiPickerOpen(false);
});
elements.categoryManagerList.addEventListener("change", (event) => {
  const row = event.target.closest("[data-category]");
  if (!row || event.target.tagName !== "INPUT") return;
  renameCategory(row.dataset.category, event.target.value);
});
elements.categoryManagerList.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="delete-category"]');
  const row = event.target.closest("[data-category]");
  if (button && row) deleteCategory(row.dataset.category);
});
elements.variantList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-variant-id]");
  const actionTarget = event.target.closest("[data-action]");
  const item = items.find((candidate) => candidate.id === activeDetailItemId);
  if (!row || !actionTarget || !item || !hasVariants(item)) return;
  if (actionTarget.dataset.action === "variant-increase") updateVariant(item, row.dataset.variantId, 1);
  if (actionTarget.dataset.action === "variant-decrease") updateVariant(item, row.dataset.variantId, -1);
  if (actionTarget.dataset.action === "variant-delete") deleteVariant(item, row.dataset.variantId);
});
elements.variantList.addEventListener("change", (event) => {
  const row = event.target.closest("[data-variant-id]");
  const item = items.find((candidate) => candidate.id === activeDetailItemId);
  if (!row || !item || event.target.tagName !== "INPUT") return;
  renameVariant(item, row.dataset.variantId, event.target.value);
});
elements.itemForm.addEventListener("submit", submitItem);
elements.deleteButton.addEventListener("click", deleteCurrentItem);
elements.searchInput.addEventListener("input", renderInventory);
elements.categoryChips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderInventory();
});

[elements.lowStockList, elements.recentList, elements.inventoryList].forEach((list) => {
  list.addEventListener("click", handleCardAction);
  list.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") handleCardAction(event);
  });
});
elements.shoppingList.addEventListener("click", handleShoppingAction);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installButton.hidden = false;
});

elements.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  elements.installButton.hidden = true;
  showToast("App 已安裝");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

renderAll();
