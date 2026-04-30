// Header hide/show on scroll
const siteHeader = document.querySelector("header");
const siteMenu = document.getElementById("site-menu");
const menuToggle = document.querySelector(".menu-toggle");
let lastScrollY = window.scrollY;
const currentPage = decodeURIComponent(window.location.pathname.split("/").pop() || "index.html");
const allModals = document.querySelectorAll(".modal");
let menuCloseTimer = null;

const updateCurrentMenuLink = () => {
  document.querySelectorAll(".menu a").forEach((link) => {
    link.classList.remove("is-current");
    const rawHref = link.getAttribute("href") || "";
    const [hrefPath, hrefHash] = rawHref.split("#");

    if (!hrefPath || hrefPath !== currentPage) return;

    if (hrefHash) {
      if (window.location.hash === `#${hrefHash}`) {
        link.classList.add("is-current");
      }
      return;
    }

    link.classList.add("is-current");
  });
};

const setMenuOpen = (isOpen) => {
  if (!siteHeader || !siteMenu || !menuToggle) return;
  siteHeader.classList.toggle("menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "收合網站選單" : "展開網站選單");
};

const shouldUseHoverMenu = () => window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1101px)").matches;

const clearMenuCloseTimer = () => {
  if (!menuCloseTimer) return;
  window.clearTimeout(menuCloseTimer);
  menuCloseTimer = null;
};

const scheduleMenuClose = () => {
  clearMenuCloseTimer();
  menuCloseTimer = window.setTimeout(() => {
    setMenuOpen(false);
  }, 120);
};

if (siteHeader && siteMenu && menuToggle) {
  siteHeader.classList.add("menu-collapsible");
  setMenuOpen(false);

  menuToggle.addEventListener("click", () => {
    if (shouldUseHoverMenu()) {
      setMenuOpen(true);
      return;
    }
    setMenuOpen(!siteHeader.classList.contains("menu-open"));
  });

  siteHeader.addEventListener("mouseenter", () => {
    if (!shouldUseHoverMenu()) return;
    clearMenuCloseTimer();
    setMenuOpen(true);
  });

  siteHeader.addEventListener("mouseleave", () => {
    if (!shouldUseHoverMenu()) return;
    scheduleMenuClose();
  });

  siteMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (!siteHeader.classList.contains("menu-open")) return;
    if (siteHeader.contains(event.target)) return;
    clearMenuCloseTimer();
    setMenuOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && siteHeader.classList.contains("menu-open")) {
      clearMenuCloseTimer();
      setMenuOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (shouldUseHoverMenu()) return;
    clearMenuCloseTimer();
  });
}

updateCurrentMenuLink();

window.addEventListener("scroll", () => {
  if (!siteHeader) return;
  const currentScrollY = window.scrollY;

  if (siteHeader.classList.contains("menu-open")) {
    siteHeader.classList.remove("header-hidden");
    lastScrollY = currentScrollY;
    return;
  }

  if (currentScrollY <= 20) {
    siteHeader.classList.remove("header-hidden");
    lastScrollY = currentScrollY;
    return;
  }

  if (currentScrollY > lastScrollY && currentScrollY > 120) {
    siteHeader.classList.add("header-hidden");
  } else {
    siteHeader.classList.remove("header-hidden");
  }

  lastScrollY = currentScrollY;
}, { passive: true });

// Modal
const ministryModal = document.getElementById("ministry-modal");
const modalTriggers = document.querySelectorAll("[data-open-modal]");
const modalCloseButtons = document.querySelectorAll("[data-close-modal]");

if (allModals.length || modalTriggers.length || modalCloseButtons.length) {
  const ministryModalEyebrow = document.getElementById("ministry-modal-eyebrow");
  const ministryModalTitle = document.getElementById("ministry-modal-title");
  const ministryModalTime = document.getElementById("ministry-modal-time");
  const ministryModalDescription = document.getElementById("ministry-modal-description");
  const ministryModalVerse = document.getElementById("ministry-modal-verse");
  let lastModalTrigger = null;

  const populateMinistryModal = (trigger) => {
    if (!ministryModal || !trigger) return;
    ministryModalEyebrow.textContent = trigger.dataset.ministryEyebrow || "MINISTRY";
    ministryModalTitle.textContent = trigger.dataset.ministryTitle || "事工介紹";
    ministryModalDescription.textContent = trigger.dataset.ministryDescription || "";
    ministryModalVerse.textContent = `經文：${trigger.dataset.ministryVerse || ""}`;

    if (trigger.dataset.ministryTime) {
      ministryModalTime.textContent = trigger.dataset.ministryTime;
      ministryModalTime.classList.remove("is-hidden");
    } else {
      ministryModalTime.textContent = "";
      ministryModalTime.classList.add("is-hidden");
    }
  };

  const openModal = (modalId, trigger = null) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (modal === ministryModal) {
      populateMinistryModal(trigger);
    }
    if (currentPage === "index.html" && modalId !== "ministry-modal" && window.location.hash !== `#${modalId}`) {
      window.history.replaceState(null, "", `#${modalId}`);
      updateCurrentMenuLink();
    }
    lastModalTrigger = trigger;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (modal.id && window.location.hash === `#${modal.id}`) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      updateCurrentMenuLink();
    }
    if (lastModalTrigger) {
      lastModalTrigger.focus();
      lastModalTrigger = null;
    }
  };

  modalTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openModal(trigger.dataset.openModal, trigger);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(trigger.dataset.openModal, trigger);
      }
    });
  });

  modalCloseButtons.forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest(".modal")));
  });

  allModals.forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".modal.is-open").forEach((modal) => closeModal(modal));
  });

  const openModalFromHash = () => {
    const modalId = decodeURIComponent(window.location.hash.replace("#", ""));
    if (!modalId) {
      updateCurrentMenuLink();
      return;
    }

    const modal = document.getElementById(modalId);
    if (!modal || !modal.classList.contains("modal")) {
      updateCurrentMenuLink();
      return;
    }

    const trigger = document.querySelector(`[data-open-modal="${modalId}"]`);
    openModal(modalId, trigger || null);
    updateCurrentMenuLink();
  };

  openModalFromHash();
  window.addEventListener("hashchange", openModalFromHash);
}
