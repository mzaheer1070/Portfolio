/**
 * Muhammad Zaheer Portfolio - Interactive Scripts
 * Lightweight, accessible vanilla JavaScript
 */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   THEME TOGGLE SYSTEM
   ========================================================================== */

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem("portfolio-theme", theme);
    } catch (e) {
        // Ignore localStorage errors (e.g. private browsing)
    }
}

function setupThemeToggle() {
    let savedTheme = null;
    try {
        savedTheme = localStorage.getItem("portfolio-theme");
    } catch (e) {
        savedTheme = null;
    }

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(savedTheme || systemTheme);

    // Listen for system theme changes if user hasn't set preference
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!localStorage.getItem("portfolio-theme")) {
            setTheme(e.matches ? "dark" : "light");
        }
    });

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const currentTheme = document.documentElement.dataset.theme || "light";
            const nextTheme = currentTheme === "dark" ? "light" : "dark";
            setTheme(nextTheme);
        });
    });
}

/* ==========================================================================
   NAVIGATION & ACTIVE STATES
   ========================================================================== */

function setupNavigation() {
    const toggle = document.querySelector(".nav-toggle");
    const panel = document.querySelector(".nav-panel");
    const currentPage = document.body.dataset.page || "home";

    document.querySelectorAll(".nav-link").forEach((link) => {
        const href = link.getAttribute("href") || "";
        const targetPage = href.replace(".html", "").replace("index", "home") || "home";

        if (targetPage === currentPage || (currentPage === "home" && href === "index.html")) {
            link.classList.add("is-active");
            link.setAttribute("aria-current", "page");
        }

        link.addEventListener("click", () => {
            if (!toggle || !panel) return;
            toggle.setAttribute("aria-expanded", "false");
            panel.classList.remove("is-open");
            document.body.classList.remove("nav-open");
        });
    });

    if (!toggle || !panel) return;

    toggle.addEventListener("click", () => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!isOpen));
        panel.classList.toggle("is-open", !isOpen);
        document.body.classList.toggle("nav-open", !isOpen);
    });

    // Close mobile nav on click outside
    document.addEventListener("click", (e) => {
        if (panel.classList.contains("is-open") && !panel.contains(e.target) && !toggle.contains(e.target)) {
            toggle.setAttribute("aria-expanded", "false");
            panel.classList.remove("is-open");
            document.body.classList.remove("nav-open");
        }
    });
}

/* ==========================================================================
   SCROLL REVEAL ANIMATIONS
   ========================================================================== */

function setupRevealAnimations() {
    const revealItems = document.querySelectorAll("[data-reveal]");

    if (!revealItems.length || prefersReducedMotion) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    document.body.classList.add("reveal-ready");

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
}

/* ==========================================================================
   TYPING ROLES ANIMATION
   ========================================================================== */

function setupTypedRoles() {
    const roleElem = document.querySelector("[data-roles]");
    if (!roleElem || prefersReducedMotion) return;

    const roles = roleElem.dataset.roles
        .split("|")
        .map((r) => r.trim())
        .filter(Boolean);

    if (roles.length < 2) return;

    let roleIndex = 0;
    let charIndex = roles[0].length;
    let isDeleting = true;
    let pauseCounter = 0;

    function tick() {
        const currentRole = roles[roleIndex];

        if (isDeleting) {
            charIndex--;
            roleElem.textContent = currentRole.substring(0, charIndex);

            if (charIndex === 0) {
                isDeleting = false;
                roleIndex = (roleIndex + 1) % roles.length;
                setTimeout(tick, 300);
                return;
            }
            setTimeout(tick, 45);
        } else {
            charIndex++;
            roleElem.textContent = currentRole.substring(0, charIndex);

            if (charIndex === currentRole.length) {
                isDeleting = true;
                setTimeout(tick, 2200); // Pause at full word
                return;
            }
            setTimeout(tick, 75);
        }
    }

    setTimeout(tick, 1800);
}

/* ==========================================================================
   ANIMATED NUMBER COUNTERS
   ========================================================================== */

function setupCounters() {
    const counters = document.querySelectorAll("[data-count-to]");
    if (!counters.length) return;

    const runCounter = (counter) => {
        const target = Number(counter.dataset.countTo);
        const duration = prefersReducedMotion ? 1 : 1100;
        const startTime = performance.now();

        const tick = (currentTime) => {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.round(target * easeProgress);

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                counter.textContent = target;
            }
        };

        requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                runCounter(entry.target);
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.5 }
    );

    counters.forEach((counter) => observer.observe(counter));
}

/* ==========================================================================
   ACCESSIBLE TABS (ABOUT PAGE)
   ========================================================================== */

function setupTabs() {
    document.querySelectorAll("[data-tabs]").forEach((tabGroup) => {
        const buttons = Array.from(tabGroup.querySelectorAll("[data-tab]"));

        buttons.forEach((button, index) => {
            button.addEventListener("click", () => {
                buttons.forEach((btn) => {
                    const panel = document.getElementById(btn.dataset.tab);
                    const isActive = btn === button;

                    btn.classList.toggle("is-active", isActive);
                    btn.setAttribute("aria-selected", String(isActive));

                    if (panel) {
                        panel.hidden = !isActive;
                    }
                });
            });

            // Keyboard navigation
            button.addEventListener("keydown", (e) => {
                let nextIndex = null;
                if (e.key === "ArrowRight") {
                    nextIndex = (index + 1) % buttons.length;
                } else if (e.key === "ArrowLeft") {
                    nextIndex = (index - 1 + buttons.length) % buttons.length;
                }

                if (nextIndex !== null) {
                    buttons[nextIndex].focus();
                    buttons[nextIndex].click();
                }
            });
        });
    });
}

/* ==========================================================================
   PROJECT FILTERS (PROJECTS PAGE)
   ========================================================================== */

function setupProjectFilters() {
    const filters = document.querySelectorAll("[data-filter]");
    const cards = document.querySelectorAll(".project-card[data-category]");

    if (!filters.length || !cards.length) return;

    filters.forEach((filter) => {
        filter.addEventListener("click", () => {
            const selected = filter.dataset.filter;

            filters.forEach((btn) => {
                const isActive = btn === filter;
                btn.classList.toggle("is-active", isActive);
                btn.setAttribute("aria-pressed", String(isActive));
            });

            cards.forEach((card) => {
                const categories = (card.dataset.category || "").split(" ");
                const match = selected === "all" || categories.includes(selected);
                card.hidden = !match;
            });
        });
    });
}

/* ==========================================================================
   EXPANDABLE CARD DETAILS
   ========================================================================== */

function setupCardDetails() {
    document.querySelectorAll(".project-card .card-toggle").forEach((button) => {
        const card = button.closest(".project-card");
        const details = card ? card.querySelector(".card-details") : null;
        if (!details) return;

        button.addEventListener("click", () => {
            const expanded = button.getAttribute("aria-expanded") === "true";
            button.setAttribute("aria-expanded", String(!expanded));
            button.textContent = expanded ? "View details" : "Hide details";
            details.hidden = expanded;
        });
    });
}

/* ==========================================================================
   CONTACT FORM VALIDATION
   ========================================================================== */

function setupContactForm() {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;

    const fields = Array.from(form.querySelectorAll("input, textarea"));
    const messageInput = form.querySelector("[data-count-input]");
    const countDisplay = form.querySelector("[data-char-count]");
    const statusDisplay = form.querySelector(".form-status");
    const submitBtn = form.querySelector("button[type='submit']");

    const setError = (field, errorMsg) => {
        const errorElem = form.querySelector(`[data-error-for="${field.name}"]`);
        field.classList.toggle("is-invalid", Boolean(errorMsg));
        if (errorElem) {
            errorElem.textContent = errorMsg;
        }
    };

    const validateField = (field) => {
        const val = field.value.trim();
        let errorMsg = "";

        if (!val) {
            const labelElem = form.querySelector(`label[for="${field.id}"]`);
            const labelName = labelElem ? labelElem.textContent : field.name;
            errorMsg = `${labelName} is required.`;
        } else if (field.type === "email" && !field.validity.valid) {
            errorMsg = "Please enter a valid email address.";
        } else if (field.name === "message" && val.length < 10) {
            errorMsg = "Message should be at least 10 characters.";
        }

        setError(field, errorMsg);
        return !errorMsg;
    };

    const updateCount = () => {
        if (!messageInput || !countDisplay) return;
        const current = messageInput.value.length;
        const max = messageInput.maxLength || 500;
        countDisplay.textContent = `${current} / ${max}`;
    };

    fields.forEach((field) => {
        field.addEventListener("input", () => {
            validateField(field);
            updateCount();
        });
        field.addEventListener("blur", () => validateField(field));
    });

    updateCount();

    form.addEventListener("submit", (e) => {
        const allValid = fields.map(validateField).every(Boolean);

        if (!allValid) {
            e.preventDefault();
            const firstInvalid = form.querySelector(".is-invalid");
            if (firstInvalid) firstInvalid.focus();
            if (statusDisplay) {
                statusDisplay.className = "form-status status-error";
                statusDisplay.textContent = "Please fill in all required fields accurately.";
            }
            return;
        }

        if (statusDisplay) {
            statusDisplay.className = "form-status status-loading";
            statusDisplay.textContent = "Sending your message...";
        }
        if (submitBtn) submitBtn.disabled = true;
    });
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    setupThemeToggle();
    setupNavigation();
    setupRevealAnimations();
    setupTypedRoles();
    setupCounters();
    setupTabs();
    setupProjectFilters();
    setupCardDetails();
    setupContactForm();
});
