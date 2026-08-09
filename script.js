const state = {
    transactions: [],
    currentType: "expense",
    balanceVisible: true,
    currency: "MYR"
};

const categories = {
    expense: [
        "Food",
        "Transport",
        "Shopping",
        "Bills",
        "Entertainment",
        "Education",
        "Health",
        "Other"
    ],
    income: [
        "Salary",
        "Allowance",
        "Bonus",
        "Gift",
        "Business",
        "Other"
    ]
};

document.addEventListener("DOMContentLoaded", function () {
    console.log("Expense Tracker JS started");

    loadData();
    setupIntro();
    setupNavigation();
    setupTransactionModal();
    setupQuickActions();
    setupFilters();
    setupSettings();

    updateAll();
});


/* =========================================================
   INTRO
========================================================= */

function setupIntro() {
    const intro = document.getElementById("introScreen");
    const login = document.getElementById("loginScreen");

    if (!intro) return;

    setTimeout(function () {
        intro.classList.add("hidden");

        if (login) {
            login.classList.remove("hidden");
        }
    }, 1800);

    const guestButton = document.getElementById("guestButton");

    if (guestButton) {
        guestButton.addEventListener("click", function () {
            if (login) {
                login.classList.add("hidden");
            }

            const app = document.getElementById("app");

            if (app) {
                app.classList.remove("hidden");
            }

            updateAll();
        });
    }

    const loginButton = document.getElementById("loginButton");

    if (loginButton) {
        loginButton.addEventListener("click", function () {
            if (login) {
                login.classList.add("hidden");
            }

            const app = document.getElementById("app");

            if (app) {
                app.classList.remove("hidden");
            }

            showToast("Welcome!");
            updateAll();
        });
    }
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach(function (button) {
        button.addEventListener("click", function () {
            const page = button.dataset.page;

            if (page) {
                showPage(page);
            }
        });
    });

    document.querySelectorAll("[data-page]").forEach(function (element) {
        if (element.classList.contains("nav-item")) return;

        element.addEventListener("click", function () {
            const page = element.dataset.page;

            if (page) {
                showPage(page);
            }
        });
    });

    const openSidebar = document.getElementById("openSidebarButton");
    const closeSidebar = document.getElementById("closeSidebarButton");
    const overlay = document.getElementById("sidebarOverlay");

    if (openSidebar) {
        openSidebar.addEventListener("click", function () {
            const sidebar = document.getElementById("sidebar");

            if (sidebar) {
                sidebar.classList.add("open");
            }

            if (overlay) {
                overlay.classList.remove("hidden");
            }
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener("click", closeSidebarMenu);
    }

    if (overlay) {
        overlay.addEventListener("click", closeSidebarMenu);
    }
}

function closeSidebarMenu() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (overlay) {
        overlay.classList.add("hidden");
    }
}

function showPage(pageName) {
    const pages = document.querySelectorAll(".page");

    pages.forEach(function (page) {
        page.classList.remove("active");
    });

    const target = document.getElementById(pageName + "Page");

    if (target) {
        target.classList.add("active");
    }

    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach(function (item) {
        item.classList.toggle(
            "active",
            item.dataset.page === pageName
        );
    });

    closeSidebarMenu();
    updateAll();
}


/* =========================================================
   QUICK ACTIONS
========================================================= */

function setupQuickActions() {
    const quickAdd = document.getElementById("quickAddButton");

    if (quickAdd) {
        quickAdd.addEventListener("click", function () {
            openTransactionModal("expense");
        });
    }

    document.querySelectorAll(".quick-action").forEach(function (button) {
        button.addEventListener("click", function () {
            const type = button.dataset.type;
            const page = button.dataset.page;

            if (type) {
                openTransactionModal(type);
            }

            if (page) {
                showPage(page);
            }
        });
    });

    const emptyAdd = document.getElementById("emptyAddButton");

    if (emptyAdd) {
        emptyAdd.addEventListener("click", function () {
            openTransactionModal("expense");
        });
    }

    const transactionAdd = document.getElementById(
        "transactionsAddButton"
    );

    if (transactionAdd) {
        transactionAdd.addEventListener("click", function () {
            openTransactionModal("expense");
        });
    }
}


/* =========================================================
   TRANSACTION MODAL
========================================================= */

function setupTransactionModal() {
    const modal = document.getElementById("transactionModal");

    const closeButton = document.getElementById(
        "closeTransactionModal"
    );

    const form = document.getElementById("transactionForm");

    if (closeButton) {
        closeButton.addEventListener("click", function () {
            closeTransactionModal();
        });
    }

    if (modal) {
        modal.addEventListener("click", function (event) {
            if (event.target === modal) {
                closeTransactionModal();
            }
        });
    }

    document.querySelectorAll(".type-button").forEach(function (button) {
        button.addEventListener("click", function () {
            setTransactionType(button.dataset.type);
        });
    });

    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            saveTransaction();
        });
    }
}

function openTransactionModal(type) {
    const modal = document.getElementById("transactionModal");

    if (!modal) return;

    setTransactionType(type || "expense");

    const amount = document.getElementById("amountInput");
    const note = document.getElementById("noteInput");
    const date = document.getElementById("dateInput");

    if (amount) {
        amount.value = "";
    }

    if (note) {
        note.value = "";
    }

    if (date) {
        const today = new Date();

        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");

        date.value = yyyy + "-" + mm + "-" + dd;
    }

    modal.classList.remove("hidden");

    setTimeout(function () {
        if (amount) {
            amount.focus();
        }
    }, 100);
}

function closeTransactionModal() {
    const modal = document.getElementById("transactionModal");

    if (modal) {
        modal.classList.add("hidden");
    }
}

function setTransactionType(type) {
    state.currentType = type;

    document.querySelectorAll(".type-button").forEach(function (button) {
        button.classList.toggle(
            "active",
            button.dataset.type === type
        );
    });

    updateCategoryOptions();
}

function updateCategoryOptions() {
    const select = document.getElementById("categoryInput");

    if (!select) return;

    select.innerHTML = "";

    const firstOption = document.createElement("option");

    firstOption.value = "";
    firstOption.textContent = "Select category";

    select.appendChild(firstOption);

    categories[state.currentType].forEach(function (category) {
        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        select.appendChild(option);
    });
}


/* =========================================================
   SAVE TRANSACTION
========================================================= */

function saveTransaction() {
    const amountInput = document.getElementById("amountInput");
    const categoryInput = document.getElementById("categoryInput");
    const dateInput = document.getElementById("dateInput");
    const noteInput = document.getElementById("noteInput");

    const amount = Number(amountInput.value);
    const category = categoryInput.value;
    const date = dateInput.value;
    const note = noteInput.value.trim();

    if (!amount || amount <= 0) {
        showToast("Please enter a valid amount", true);
        return;
    }

    if (!category) {
        showToast("Please select a category", true);
        return;
    }

    if (!date) {
        showToast("Please select a date", true);
        return;
    }

    const transaction = {
        id: Date.now(),
        type: state.currentType,
        amount: amount,
        category: category,
        date: date,
        note: note
    };

    state.transactions.unshift(transaction);

    saveData();
    closeTransactionModal();
    updateAll();

    showToast(
        state.currentType === "income"
            ? "Income added successfully"
            : "Expense added successfully"
    );
}


/* =========================================================
   CALCULATIONS
========================================================= */

function getIncome() {
    return state.transactions
        .filter(function (transaction) {
            return transaction.type === "income";
        })
        .reduce(function (total, transaction) {
            return total + Number(transaction.amount);
        }, 0);
}

function getExpenses() {
    return state.transactions
        .filter(function (transaction) {
            return transaction.type === "expense";
        })
        .reduce(function (total, transaction) {
            return total + Number(transaction.amount);
        }, 0);
}

function getBalance() {
    return getIncome() - getExpenses();
}


/* =========================================================
   UPDATE DASHBOARD
========================================================= */

function updateDashboard() {
    const income = getIncome();
    const expenses = getExpenses();
    const balance = income - expenses;

    setMoney("balanceAmount", balance);
    setMoney("incomeAmount", income);
    setMoney("expenseAmount", expenses);

    const status = document.getElementById("balanceStatus");

    if (status) {
        if (balance > 0) {
            status.textContent = "Healthy";
        } else if (balance === 0) {
            status.textContent = "Balanced";
        } else {
            status.textContent = "Over budget";
        }
    }

    renderRecentTransactions();
}

function setMoney(id, amount) {
    const element = document.getElementById(id);

    if (!element) return;

    if (!state.balanceVisible && id === "balanceAmount") {
        element.textContent = "RM •••••";
        return;
    }

    element.textContent = formatCurrency(amount);
}

function formatCurrency(amount) {
    const currency = state.currency || "MYR";

    const symbols = {
        MYR: "RM",
        USD: "$",
        SGD: "S$",
        CNY: "¥",
        EUR: "€",
        GBP: "£",
        JPY: "¥",
        AUD: "A$"
    };

    const symbol = symbols[currency] || currency;

    return (
        symbol +
        " " +
        Number(amount).toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    );
}


/* =========================================================
   RECENT TRANSACTIONS
========================================================= */

function renderRecentTransactions() {
    const container = document.getElementById(
        "recentTransactions"
    );

    if (!container) return;

    container.innerHTML = "";

    if (state.transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-receipt"></i>
                </div>

                <h4>No transactions yet</h4>

                <p>
                    Add your first transaction
                    to get started.
                </p>

                <button
                    class="primary-button"
                    id="recentEmptyAdd"
                    type="button"
                >
                    <i class="fa-solid fa-plus"></i>
                    Add transaction
                </button>
            </div>
        `;

        const button = document.getElementById(
            "recentEmptyAdd"
        );

        if (button) {
            button.addEventListener("click", function () {
                openTransactionModal("expense");
            });
        }

        return;
    }

    state.transactions
        .slice(0, 5)
        .forEach(function (transaction) {
            container.appendChild(
                createTransactionElement(transaction)
            );
        });
}

function createTransactionElement(transaction) {
    const item = document.createElement("div");

    item.className = "transaction-item";

    const icon = transaction.type === "income"
        ? "fa-arrow-down"
        : "fa-arrow-up";

    const sign = transaction.type === "income"
        ? "+"
        : "-";

    const amountClass = transaction.type === "income"
        ? "income"
        : "expense";

    item.innerHTML = `
        <div class="transaction-icon ${amountClass}">
            <i class="fa-solid ${icon}"></i>
        </div>

        <div class="transaction-info">
            <strong>
                ${escapeHTML(transaction.category)}
            </strong>

            <span>
                ${escapeHTML(
                    transaction.note ||
                    transaction.date
                )}
            </span>
        </div>

        <div class="transaction-amount ${amountClass}">
            ${sign}${formatCurrency(transaction.amount)}
        </div>
    `;

    return item;
}


/* =========================================================
   TRANSACTIONS PAGE
========================================================= */

function renderAllTransactions() {
    const container = document.getElementById(
        "allTransactions"
    );

    if (!container) return;

    const searchElement =
        document.getElementById("searchInput");

    const typeElement =
        document.getElementById("typeFilter");

    const categoryElement =
        document.getElementById("categoryFilter");

    const dateElement =
        document.getElementById("dateFilter");

    const search =
        searchElement
            ? searchElement.value.toLowerCase()
            : "";

    const type =
        typeElement
            ? typeElement.value
            : "all";

    const category =
        categoryElement
            ? categoryElement.value
            : "all";

    const dateFilter =
        dateElement
            ? dateElement.value
            : "all";

    let filtered = state.transactions.filter(
        function (transaction) {
            const matchesSearch =
                transaction.category
                    .toLowerCase()
                    .includes(search) ||

                (transaction.note || "")
                    .toLowerCase()
                    .includes(search);

            const matchesType =
                type === "all" ||
                transaction.type === type;

            const matchesCategory =
                category === "all" ||
                transaction.category === category;

            let matchesDate = true;

            if (dateFilter !== "all") {
                const transactionDate =
                    new Date(transaction.date);

                const today = new Date();

                if (dateFilter === "today") {
                    matchesDate =
                        transactionDate.toDateString() ===
                        today.toDateString();
                }

                if (dateFilter === "week") {
                    const weekAgo = new Date();

                    weekAgo.setDate(
                        today.getDate() - 7
                    );

                    matchesDate =
                        transactionDate >= weekAgo;
                }

                if (dateFilter === "month") {
                    matchesDate =
                        transactionDate.getMonth() ===
                        today.getMonth() &&

                        transactionDate.getFullYear() ===
                        today.getFullYear();
                }
            }

            return (
                matchesSearch &&
                matchesType &&
                matchesCategory &&
                matchesDate
            );
        }
    );

    container.innerHTML = "";

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fa-solid fa-receipt"></i>
                </div>

                <h4>No transactions found</h4>
            </div>
        `;

        return;
    }

    filtered.forEach(function (transaction) {
        const element =
            createTransactionElement(transaction);

        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "icon-button transaction-delete";

        deleteButton.type = "button";

        deleteButton.innerHTML =
            '<i class="fa-solid fa-trash"></i>';

        deleteButton.addEventListener(
            "click",
            function () {
                deleteTransaction(transaction.id);
            }
        );

        element.appendChild(deleteButton);
        container.appendChild(element);
    });
}

function deleteTransaction(id) {
    const confirmed =
        confirm("Delete this transaction?");

    if (!confirmed) return;

    state.transactions =
        state.transactions.filter(
            function (transaction) {
                return transaction.id !== id;
            }
        );

    saveData();
    updateAll();

    showToast("Transaction deleted");
}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {
    [
        "searchInput",
        "typeFilter",
        "categoryFilter",
        "dateFilter"
    ].forEach(function (id) {
        const element =
            document.getElementById(id);

        if (!element) return;

        element.addEventListener(
            "input",
            renderAllTransactions
        );

        element.addEventListener(
            "change",
            renderAllTransactions
        );
    });

    updateCategoryFilter();
}

function updateCategoryFilter() {
    const select =
        document.getElementById("categoryFilter");

    if (!select) return;

    const current =
        select.value || "all";

    const allCategories = [
        ...categories.expense,
        ...categories.income
    ];

    const unique =
        [...new Set(allCategories)];

    select.innerHTML =
        '<option value="all">All categories</option>';

    unique.forEach(function (category) {
        const option =
            document.createElement("option");

        option.value = category;
        option.textContent = category;

        select.appendChild(option);
    });

    select.value = current;
}


/* =========================================================
   ANALYTICS
========================================================= */

function updateAnalytics() {
    const income = getIncome();
    const expenses = getExpenses();
    const savings = income - expenses;

    setMoney("analyticsIncome", income);
    setMoney("analyticsExpenses", expenses);
    setMoney("analyticsSavings", savings);

    const count =
        document.getElementById("analyticsCount");

    if (count) {
        count.textContent =
            state.transactions.length;
    }

    renderCategoryChart();
}

function renderCategoryChart() {
    const container =
        document.getElementById("categoryChart");

    if (!container) return;

    const expenses =
        state.transactions.filter(
            function (transaction) {
                return transaction.type === "expense";
            }
        );

    if (expenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>
                    Add transactions to see
                    your spending breakdown.
                </p>
            </div>
        `;

        return;
    }

    const totals = {};

    expenses.forEach(function (transaction) {
        if (!totals[transaction.category]) {
            totals[transaction.category] = 0;
        }

        totals[transaction.category] +=
            Number(transaction.amount);
    });

    const total =
        Object.values(totals)
            .reduce(
                function (sum, value) {
                    return sum + value;
                },
                0
            );

    container.innerHTML = "";

    Object.entries(totals)
        .sort(function (a, b) {
            return b[1] - a[1];
        })
        .forEach(function ([category, amount]) {
            const percentage =
                total === 0
                    ? 0
                    : (amount / total) * 100;

            const row =
                document.createElement("div");

            row.className =
                "category-row";

            row.innerHTML = `
                <div class="category-row-top">
                    <strong>
                        ${escapeHTML(category)}
                    </strong>

                    <span>
                        ${formatCurrency(amount)}
                    </span>
                </div>

                <div class="category-bar">
                    <div
                        class="category-bar-fill"
                        style="width:${percentage}%"
                    ></div>
                </div>
            `;

            container.appendChild(row);
        });
}


/* =========================================================
   BALANCE VISIBILITY
========================================================= */

function setupBalanceToggle() {
    const button =
        document.getElementById(
            "toggleBalanceButton"
        );

    if (!button) return;

    button.addEventListener(
        "click",
        function () {
            state.balanceVisible =
                !state.balanceVisible;

            const icon =
                document.getElementById(
                    "balanceEyeIcon"
                );

            if (icon) {
                icon.className =
                    state.balanceVisible
                        ? "fa-regular fa-eye"
                        : "fa-regular fa-eye-slash";
            }

            updateDashboard();
        }
    );
}


/* =========================================================
   SETTINGS
========================================================= */

function setupSettings() {
    setupBalanceToggle();

    document
        .querySelectorAll("[data-theme]")
        .forEach(function (button) {
            button.addEventListener(
                "click",
                function () {
                    document
                        .querySelectorAll("[data-theme]")
                        .forEach(function (item) {
                            item.classList.remove("active");
                        });

                    button.classList.add("active");

                    const theme =
                        button.dataset.theme;

                    applyTheme(theme);

                    localStorage.setItem(
                        "expense_theme",
                        theme
                    );
                }
            );
        });

    const language =
        document.getElementById(
            "languageSelect"
        );

    if (language) {
        language.addEventListener(
            "change",
            function () {
                localStorage.setItem(
                    "expense_language",
                    language.value
                );

                showToast(
                    language.value === "zh"
                        ? "语言已更新"
                        : "Language updated"
                );
            }
        );
    }

    const currency =
        document.getElementById(
            "currencySelect"
        );

    if (currency) {
        currency.addEventListener(
            "change",
            function () {
                state.currency =
                    currency.value;

                localStorage.setItem(
                    "expense_currency",
                    state.currency
                );

                updateAll();

                showToast(
                    "Currency updated"
                );
            }
        );
    }

    const primary =
        document.getElementById(
            "primaryColor"
        );

    const secondary =
        document.getElementById(
            "secondaryColor"
        );

    if (primary) {
        primary.addEventListener(
            "input",
            function () {
                document.documentElement
                    .style.setProperty(
                        "--primary",
                        primary.value
                    );
            }
        );
    }

    if (secondary) {
        secondary.addEventListener(
            "input",
            function () {
                document.documentElement
                    .style.setProperty(
                        "--secondary",
                        secondary.value
                    );
            }
        );
    }

    const generate =
        document.getElementById(
            "generateThemeButton"
        );

    if (generate) {
        generate.addEventListener(
            "click",
            function () {
                const colors = [
                    ["#7C5CFC", "#5CC8FF"],
                    ["#00A896", "#02C39A"],
                    ["#FF6B6B", "#FFB86B"],
                    ["#5B8DEF", "#8A5CF6"],
                    ["#E056FD", "#686DE0"]
                ];

                const random =
                    colors[
                        Math.floor(
                            Math.random() *
                            colors.length
                        )
                    ];

                if (primary) {
                    primary.value = random[0];
                }

                if (secondary) {
                    secondary.value = random[1];
                }

                document.documentElement
                    .style.setProperty(
                        "--primary",
                        random[0]
                    );

                document.documentElement
                    .style.setProperty(
                        "--secondary",
                        random[1]
                    );

                showToast(
                    "Beautiful theme generated"
                );
            }
        );
    }

    const logout =
        document.getElementById(
            "logoutButton"
        );

    if (logout) {
        logout.addEventListener(
            "click",
            function () {
                const app =
                    document.getElementById("app");

                const login =
                    document.getElementById(
                        "loginScreen"
                    );

                if (app) {
                    app.classList.add("hidden");
                }

                if (login) {
                    login.classList.remove("hidden");
                }
            }
        );
    }
}

function applyTheme(theme) {
    if (theme === "dark") {
        document.documentElement
            .setAttribute("data-theme", "dark");
    } else if (theme === "light") {
        document.documentElement
            .setAttribute("data-theme", "light");
    } else {
        document.documentElement
            .removeAttribute("data-theme");
    }
}


/* =========================================================
   STORAGE
========================================================= */

function saveData() {
    localStorage.setItem(
        "expense_transactions",
        JSON.stringify(state.transactions)
    );
}

function loadData() {
    try {
        const saved =
            localStorage.getItem(
                "expense_transactions"
            );

        if (saved) {
            state.transactions =
                JSON.parse(saved);
        }

        const currency =
            localStorage.getItem(
                "expense_currency"
            );

        if (currency) {
            state.currency = currency;

            const select =
                document.getElementById(
                    "currencySelect"
                );

            if (select) {
                select.value = currency;
            }
        }

        const theme =
            localStorage.getItem(
                "expense_theme"
            );

        if (theme) {
            applyTheme(theme);

            document
                .querySelectorAll("[data-theme]")
                .forEach(function (button) {
                    button.classList.toggle(
                        "active",
                        button.dataset.theme === theme
                    );
                });
        }
    } catch (error) {
        console.error(
            "Failed to load saved data:",
            error
        );

        state.transactions = [];
    }
}


/* =========================================================
   UPDATE EVERYTHING
========================================================= */

function updateAll() {
    updateDashboard();
    updateAnalytics();
    updateCategoryFilter();
    renderAllTransactions();
    updateUserInfo();
    updateCategoryOptions();
}


/* =========================================================
   USER
========================================================= */

function updateUserInfo() {
    const name = "User";
    const greeting = getGreeting();

    const userName =
        document.getElementById("userName");

    const greetingElement =
        document.getElementById("greeting");

    if (userName) {
        userName.textContent = name;
    }

    if (greetingElement) {
        greetingElement.textContent =
            greeting;
    }

    const sidebarName =
        document.getElementById(
            "sidebarUserName"
        );

    const sidebarEmail =
        document.getElementById(
            "sidebarUserEmail"
        );

    const settingsName =
        document.getElementById(
            "settingsUserName"
        );

    const settingsEmail =
        document.getElementById(
            "settingsUserEmail"
        );

    if (sidebarName) {
        sidebarName.textContent = name;
    }

    if (sidebarEmail) {
        sidebarEmail.textContent = "Guest";
    }

    if (settingsName) {
        settingsName.textContent = name;
    }

    if (settingsEmail) {
        settingsEmail.textContent = "Guest";
    }
}

function getGreeting() {
    const hour =
        new Date().getHours();

    if (hour < 12) {
        return "Good morning";
    }

    if (hour < 18) {
        return "Good afternoon";
    }

    return "Good evening";
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message, error) {
    const toast =
        document.getElementById("toast");

    const messageElement =
        document.getElementById(
            "toastMessage"
        );

    if (!toast || !messageElement) return;

    messageElement.textContent =
        message;

    toast.classList.toggle(
        "error",
        Boolean(error)
    );

    toast.classList.add("show");

    setTimeout(function () {
        toast.classList.remove("show");
    }, 2500);
}


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}