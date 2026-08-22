import { app, db } from "./firebase-config.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setDoc,
    deleteField
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();


/* =========================================================
   STATE
========================================================= */

const state = {
    transactions: [],
    currentType: "expense",
    balanceVisible: true,
    currency: "MYR",
    currentUser: null,
    unsubscribeTransactions: null,
    guestMode: false,
    currentPage: "dashboard",
    activeModal: null,
    editingTransactionId: null,
    selectedMonth: getMonthKey(new Date()),
    selectedDate: getDateKey(new Date()),
    followingToday: true,
    currentBudget: null,
    unsubscribeBudget: null,
    spendingChart: null,
    syncStatus: navigator.onLine ? "synced" : "offline",
    pendingUndo: null,
    toastTimer: null
};


/* =========================================================
   CATEGORIES
========================================================= */

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


/* =========================================================
   START APP
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("Expense Tracker JS started");

    setupLogin();
    setupGuestLogin();
    setupIntro();
    setupNavigation();
    setupMobileBackNavigation();
    setupTransactionModal();
    setupTransactionView();
    setupHistoryNavigation();
    setupQuickActions();
    setupFilters();
    setupSettings();

    loadLocalSettings();
    updateAll();

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, function (user) {

    if (user) {

        console.log("User signed in:", user);

        state.currentUser = user;
        state.guestMode = false;

        updateUserProfile(user);

        hideIntro();
        hideLogin();
        showApp();

        loadFirestoreTransactions(user.uid);

    } else {

        console.log("No user signed in.");

        if (!state.guestMode) {

            state.currentUser = null;
            state.transactions = [];

            if (state.unsubscribeTransactions) {
                state.unsubscribeTransactions();
                state.unsubscribeTransactions = null;
            }

            updateUserProfile(null);

        }

    }

});


/* =========================================================
   GOOGLE LOGIN
========================================================= */

function setupLogin() {

    const loginButton =
        document.getElementById("loginButton");

    console.log("LOGIN BUTTON:", loginButton);

    if (!loginButton) {
        console.error("loginButton not found");
        return;
    }

    loginButton.addEventListener("click", async function () {

        console.log("GOOGLE BUTTON CLICKED");

        try {

            console.log("Opening Google popup...");

            const result =
                await signInWithPopup(
                    auth,
                    googleProvider
                );

            console.log(
                "GOOGLE LOGIN SUCCESS:",
                result.user
            );

            state.currentUser =
                result.user;

            state.guestMode = false;

            updateUserProfile(
                result.user
            );

            hideIntro();
            hideLogin();
            showApp();

            showToast(
                "Welcome, " +
                (
                    result.user.displayName ||
                    "User"
                ) +
                "!"
            );

        } catch (error) {

            console.error(
                "GOOGLE LOGIN ERROR:",
                error
            );

            console.error(
                "ERROR CODE:",
                error.code
            );

            console.error(
                "ERROR MESSAGE:",
                error.message
            );

            alert(
                "Google Login Error\n\n" +
                error.code +
                "\n\n" +
                error.message
            );

        }

    });

}


/* =========================================================
   GUEST LOGIN
========================================================= */

function setupGuestLogin() {

    const guestButton =
        document.getElementById("guestButton");

    if (!guestButton) {
        return;
    }

    guestButton.addEventListener(
        "click",
        function () {

            console.log("Guest mode");

            state.guestMode = true;
            state.currentUser = null;
            state.transactions = loadGuestTransactions();

            hideIntro();
            hideLogin();
            showApp();

            updateAll();

            showToast("Guest mode");

        }
    );

}


/* =========================================================
   INTRO
========================================================= */

function setupIntro() {

    const intro =
        document.getElementById("introScreen");

    const login =
        document.getElementById("loginScreen");

    const appScreen =
        document.getElementById("app");

    console.log(
        "Intro screen:",
        intro
    );

    if (!intro) {
        return;
    }

    setTimeout(function () {

        intro.classList.add("hidden");

        if (state.currentUser) {

            if (login) {
                login.classList.add("hidden");
            }

            if (appScreen) {
                appScreen.classList.remove("hidden");
            }

        } else if (state.guestMode) {

            if (login) {
                login.classList.add("hidden");
            }

            if (appScreen) {
                appScreen.classList.remove("hidden");
            }

        } else {

            if (login) {
                login.classList.remove("hidden");
            }

            if (appScreen) {
                appScreen.classList.add("hidden");
            }

        }

    }, 1800);

}


/* =========================================================
   SHOW / HIDE
========================================================= */

function hideIntro() {

    const intro =
        document.getElementById("introScreen");

    if (intro) {
        intro.classList.add("hidden");
    }

}


function hideLogin() {

    const login =
        document.getElementById("loginScreen");

    if (login) {
        login.classList.add("hidden");
    }

}


function showLogin() {

    const login =
        document.getElementById("loginScreen");

    if (login) {
        login.classList.remove("hidden");
    }

}


function showApp() {

    const appScreen =
        document.getElementById("app");

    if (appScreen) {
        appScreen.classList.remove("hidden");
    }

}


function hideApp() {

    const appScreen =
        document.getElementById("app");

    if (appScreen) {
        appScreen.classList.add("hidden");
    }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

    try {

        await signOut(auth);

        state.currentUser = null;
        state.guestMode = false;
        state.transactions = [];

        if (state.unsubscribeTransactions) {

            state.unsubscribeTransactions();

            state.unsubscribeTransactions =
                null;

        }

        hideApp();
        showLogin();

        showToast("Logged out");

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );

        showToast(
            "Logout failed",
            true
        );

    }

}


/* =========================================================
   FIRESTORE LOAD
========================================================= */

function loadFirestoreTransactions(userId) {

    if (!userId) {
        return;
    }

    if (state.unsubscribeTransactions) {

        state.unsubscribeTransactions();

    }

    const transactionsRef =
        collection(
            db,
            "users",
            userId,
            "transactions"
        );

    state.unsubscribeTransactions =
        onSnapshot(
            transactionsRef,
            function (snapshot) {

                state.transactions =
                    snapshot.docs.map(
                        function (document) {

                            const data =
                                document.data();

                            return {
                                id: document.id,
                                type:
                                    data.type ||
                                    "expense",
                                amount:
                                    Number(
                                        data.amount ||
                                        0
                                    ),
                                category:
                                    data.category ||
                                    "Other",
                                date:
                                    data.date ||
                                    "",
                                note:
                                    data.note ||
                                    "",
                                createdAt: data.createdAt || null
                            };

                        }
                    ).sort(sortTransactionsNewestFirst);

                updateAll();

            },
            function (error) {

                console.error(
                    "Firestore error:",
                    error
                );

                showToast(
                    "Could not load transactions",
                    true
                );

            }
        );

}


/* =========================================================
   SAVE TRANSACTION
========================================================= */

async function saveTransaction() {

    const amountInput =
        document.getElementById("amountInput");

    const categoryInput =
        document.getElementById("categoryInput");

    const dateInput =
        document.getElementById("dateInput");

    const noteInput =
        document.getElementById("noteInput");


    if (
        !amountInput ||
        !categoryInput ||
        !dateInput ||
        !noteInput
    ) {
        return;
    }


    const amount =
        Number(amountInput.value);

    const category =
        categoryInput.value;

    const date =
        dateInput.value;

    const note =
        noteInput.value.trim();


    if (!amount || amount <= 0) {

        showToast(
            "Please enter a valid amount",
            true
        );

        return;

    }


    if (!category) {

        showToast(
            "Please select a category",
            true
        );

        return;

    }


    if (!date) {

        showToast(
            "Please select a date",
            true
        );

        return;

    }

    const transactionData = {
        type: state.currentType,
        amount: amount,
        category: category,
        date: date,
        note: note
    };

    if (state.editingTransactionId) {

        const id = state.editingTransactionId;

        if (state.guestMode) {

            state.transactions = state.transactions.map(
                function (transaction) {
                    return transaction.id === id
                        ? { ...transaction, ...transactionData }
                        : transaction;
                }
            );

            persistGuestTransactions();

            closeTransactionModal();
            updateAll();
            showToast("Transaction updated");
            return;

        }

        if (!state.currentUser) {
            showToast("Please login first", true);
            return;
        }

        try {

            await updateDoc(
                doc(
                    db,
                    "users",
                    state.currentUser.uid,
                    "transactions",
                    id
                ),
                transactionData
            );

            closeTransactionModal();
            showToast("Transaction updated");

        } catch (error) {

            console.error("Failed to update transaction:", error);
            showToast("Failed to update transaction", true);

        }

        return;

    }


    if (!state.currentUser) {

        if (state.guestMode) {

            const transaction = {
                id:
                    Date.now().toString(),
                ...transactionData
            };

            state.transactions.unshift(
                transaction
            );

            persistGuestTransactions();

            closeTransactionModal();
            updateAll();

            showToast(
                "Transaction added"
            );

            return;

        }

        showToast(
            "Please login first",
            true
        );

        return;

    }


    try {

        const transactionsRef =
            collection(
                db,
                "users",
                state.currentUser.uid,
                "transactions"
            );


        await addDoc(
            transactionsRef,
            {
                ...transactionData,
                createdAt:
                    serverTimestamp()
            }
        );


        closeTransactionModal();

        showToast(
            state.currentType === "income"
                ? "Income added successfully"
                : "Expense added successfully"
        );

    } catch (error) {

        console.error(
            "Failed to save transaction:",
            error
        );

        showToast(
            "Failed to save transaction",
            true
        );

    }

}


/* =========================================================
   DELETE TRANSACTION
========================================================= */

async function deleteTransaction(id) {

    const viewDelete =
        document.getElementById("deleteTransactionButton");

    if (viewDelete && viewDelete.dataset.transactionId === id) {
        closeTransactionView();
    }


    if (state.guestMode) {

        state.transactions =
            state.transactions.filter(
                function (transaction) {
                    return transaction.id !== id;
                }
            );

        persistGuestTransactions();

        updateAll();

        showToast(
            "Transaction deleted"
        );

        return;

    }


    if (!state.currentUser) {
        return;
    }


    const transaction = state.transactions.find(function (item) { return item.id === id; });
    if (!transaction) return;
    state.transactions = state.transactions.filter(function (item) { return item.id !== id; });
    updateAll();
    try {
        setSyncStatus("saving");
        await deleteDoc(doc(db, "users", state.currentUser.uid, "transactions", id));
        setSyncStatus("synced");
        showUndoToast(transaction);

    } catch (error) {

        state.transactions.unshift(transaction); updateAll(); setSyncStatus("failed"); console.error(
            "Delete failed:",
            error
        );

        showToast(
            "Delete failed",
            true
        );

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const page =
                        button.dataset.page;

                    if (page) {
                        showPage(page);
                    }

                }
            );

        });


    document
        .querySelectorAll("[data-page]")
        .forEach(function (element) {

            if (
                element.classList.contains(
                    "nav-item"
                )
            ) {
                return;
            }

            element.addEventListener(
                "click",
                function () {

                    const page =
                        element.dataset.page;

                    if (page) {
                        showPage(page);
                    }

                }
            );

        });


    const openSidebar =
        document.getElementById(
            "openSidebarButton"
        );

    const closeSidebar =
        document.getElementById(
            "closeSidebarButton"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (openSidebar) {

        openSidebar.addEventListener(
            "click",
            function () {

                const sidebar =
                    document.getElementById(
                        "sidebar"
                    );

                if (sidebar) {
                    sidebar.classList.add(
                        "open"
                    );
                }

                if (overlay) {
                    overlay.classList.remove(
                        "hidden"
                    );
                }

            }
        );

    }


    if (closeSidebar) {

        closeSidebar.addEventListener(
            "click",
            closeSidebarMenu
        );

    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebarMenu
        );

    }

}


function closeSidebarMenu() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );


    if (sidebar) {
        sidebar.classList.remove(
            "open"
        );
    }

    if (overlay) {
        overlay.classList.add(
            "hidden"
        );
    }

}


function createHistoryState(page, modal = null, transactionId = null) {

    return {
        expenseTracker: true,
        page: page,
        modal: modal,
        transactionId: transactionId
    };

}


function setupHistoryNavigation() {

    const current = history.state;

    if (!current || !current.expenseTracker) {
        history.replaceState(
            createHistoryState("dashboard"),
            "",
            window.location.href
        );
    }

    window.addEventListener("popstate", function (event) {

        const entry = event.state;

        // A null/external entry means the browser is leaving this app. Do not
        // push another entry or trap the device/browser Back action.
        if (!entry || !entry.expenseTracker) {
            return;
        }

        showPage(entry.page || "dashboard", "none");
        restoreModalFromHistory(entry);

    });

}


function showPage(pageName, historyMode = "push") {

    const target =
        document.getElementById(
            pageName + "Page"
        );


    if (!target) {
        console.warn("Unknown page:", pageName);
        return;
    }


    if (pageName === state.currentPage) {
        return;
    }

    if (historyMode === "push") {
        history.pushState(
            createHistoryState(pageName),
            "",
            window.location.href
        );
    }


    state.currentPage = pageName;

    document
        .querySelectorAll(".page")
        .forEach(function (page) {

            page.classList.remove(
                "active"
            );

        });

    target.classList.add(
        "active"
    );


    document
        .querySelectorAll(".nav-item")
        .forEach(function (item) {

            item.classList.toggle(
                "active",
                item.dataset.page ===
                pageName
            );

        });


    closeSidebarMenu();

    updateAll();

}


function setupMobileBackNavigation() {

    document
        .querySelectorAll("[data-back]")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    if (state.currentPage !== "dashboard") {
                        history.back();
                    }

                }
            );

        });

}


/* =========================================================
   QUICK ACTIONS
========================================================= */

function setupQuickActions() {

    const quickAdd =
        document.getElementById(
            "quickAddButton"
        );


    if (quickAdd) {

        quickAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }


    document
        .querySelectorAll(".quick-action")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const type =
                        button.dataset.type;

                    const page =
                        button.dataset.page;


                    if (type) {

                        openTransactionModal(
                            type
                        );

                    }


                    if (page) {

                        showPage(
                            page
                        );

                    }

                }
            );

        });


    const emptyAdd =
        document.getElementById(
            "emptyAddButton"
        );


    if (emptyAdd) {

        emptyAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }


    const transactionAdd =
        document.getElementById(
            "transactionsAddButton"
        );


    if (transactionAdd) {

        transactionAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }

}


/* =========================================================
   TRANSACTION MODAL
========================================================= */

function setupTransactionModal() {

    const modal =
        document.getElementById(
            "transactionModal"
        );

    const closeButton =
        document.getElementById(
            "closeTransactionModal"
        );

    const form =
        document.getElementById(
            "transactionForm"
        );

    const mobileBackButton =
        document.getElementById(
            "mobileTransactionBack"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeTransactionModal
        );

    }


    if (mobileBackButton) {

        mobileBackButton.addEventListener(
            "click",
            closeTransactionModal
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === modal
                ) {

                    closeTransactionModal();

                }

            }
        );

    }


    document
        .querySelectorAll(".type-button")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    setTransactionType(
                        button.dataset.type
                    );

                }
            );

        });


    if (form) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                saveTransaction();

            }
        );

    }

}


function openTransactionModal(type, transaction = null) {

    history.pushState(
        createHistoryState(
            state.currentPage,
            "transaction",
            transaction ? transaction.id : null
        ),
        "",
        window.location.href
    );

    displayTransactionModal(type, transaction);

}


function displayTransactionModal(type, transaction = null) {

    const modal =
        document.getElementById(
            "transactionModal"
        );


    if (!modal) {
        return;
    }


    state.editingTransactionId = transaction ? transaction.id : null;

    setTransactionType(type || "expense");


    const amount =
        document.getElementById(
            "amountInput"
        );

    const note =
        document.getElementById(
            "noteInput"
        );

    const date =
        document.getElementById(
            "dateInput"
        );

    const category =
        document.getElementById(
            "categoryInput"
        );


    if (amount) {
        amount.value = transaction ? transaction.amount : "";
    }


    if (note) {
        note.value = transaction ? (transaction.note || "") : "";
    }

    if (category) {
        category.value = transaction ? transaction.category : "";
    }


    if (date && transaction) {

        date.value = transaction.date || "";

    } else if (date) {

        const today =
            new Date();

        const yyyy =
            today.getFullYear();

        const mm =
            String(
                today.getMonth() + 1
            ).padStart(
                2,
                "0"
            );

        const dd =
            String(
                today.getDate()
            ).padStart(
                2,
                "0"
            );


        date.value =
            yyyy +
            "-" +
            mm +
            "-" +
            dd;

    }


    const title = modal.querySelector("h2");
    const submitButton = modal.querySelector("button[type='submit']");

    if (title) {
        title.textContent = transaction ? "Edit transaction" : "Add transaction";
    }

    if (submitButton) {
        submitButton.innerHTML = transaction
            ? '<i class="fa-solid fa-check"></i> Save changes'
            : '<i class="fa-solid fa-check"></i> Save transaction';
    }

    document.getElementById("transactionViewModal")?.classList.add("hidden");
    modal.classList.remove("hidden");
    state.activeModal = "transaction";


    setTimeout(
        function () {

            if (amount) {
                amount.focus();
            }

        },
        100
    );

}


function closeTransactionModal() {

    if (state.activeModal === "transaction" && history.state?.expenseTracker && history.state.modal === "transaction") {
        history.back();
        return;
    }

    hideTransactionModal();

}


function hideTransactionModal() {

    const modal =
        document.getElementById(
            "transactionModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

    state.activeModal = null;
    state.editingTransactionId = null;

}


function restoreModalFromHistory(entry) {

    if (entry.modal === "transaction") {
        const transaction = entry.transactionId
            ? state.transactions.find(function (item) { return item.id === entry.transactionId; })
            : null;

        displayTransactionModal(transaction ? transaction.type : state.currentType, transaction);
        return;
    }

    if (entry.modal === "view") {
        const transaction = state.transactions.find(function (item) {
            return item.id === entry.transactionId;
        });

        if (transaction) {
            displayTransactionView(transaction);
            return;
        }
    }

    hideTransactionModal();
    hideTransactionView();

}


function setupTransactionView() {

    const modal = document.getElementById("transactionViewModal");
    const closeButton = document.getElementById("closeTransactionView");
    const editButton = document.getElementById("editTransactionButton");
    const deleteButton = document.getElementById("deleteTransactionButton");

    closeButton?.addEventListener("click", closeTransactionView);

    modal?.addEventListener("click", function (event) {
        if (event.target === modal) {
            closeTransactionView();
        }
    });

    editButton?.addEventListener("click", function () {
        const transaction = state.transactions.find(function (item) {
            return item.id === editButton.dataset.transactionId;
        });

        if (transaction) {
            openTransactionModal(transaction.type, transaction);
        }
    });

    deleteButton?.addEventListener("click", function () {
        if (deleteButton.dataset.transactionId) {
            deleteTransaction(deleteButton.dataset.transactionId);
        }
    });

}


function openTransactionView(transaction) {

    history.pushState(
        createHistoryState(state.currentPage, "view", transaction.id),
        "",
        window.location.href
    );

    displayTransactionView(transaction);

}


function displayTransactionView(transaction) {

    const modal = document.getElementById("transactionViewModal");
    if (!modal) {
        return;
    }

    const sign = transaction.type === "income" ? "+" : "-";
    const amountClass = transaction.type === "income" ? "income" : "expense";

    document.getElementById("viewTransactionType").textContent =
        transaction.type === "income" ? "Income" : "Expense";
    document.getElementById("viewTransactionAmount").textContent =
        sign + formatCurrency(transaction.amount);
    document.getElementById("viewTransactionAmount").className =
        "view-transaction-amount " + amountClass;
    document.getElementById("viewTransactionCategory").textContent = transaction.category || "—";
    document.getElementById("viewTransactionDate").textContent = transaction.date || "—";
    document.getElementById("viewTransactionNote").textContent = transaction.note || "—";
    document.getElementById("editTransactionButton").dataset.transactionId = transaction.id;
    document.getElementById("deleteTransactionButton").dataset.transactionId = transaction.id;

    document.getElementById("transactionModal")?.classList.add("hidden");
    modal.classList.remove("hidden");
    state.activeModal = "view";
    state.editingTransactionId = null;

}


function closeTransactionView() {

    if (state.activeModal === "view" && history.state?.expenseTracker && history.state.modal === "view") {
        history.back();
        return;
    }

    hideTransactionView();

}


function hideTransactionView() {

    document.getElementById("transactionViewModal")?.classList.add("hidden");

    if (state.activeModal === "view") {
        state.activeModal = null;
    }

}


function setTransactionType(type) {

    state.currentType =
        type || "expense";


    document
        .querySelectorAll(".type-button")
        .forEach(function (button) {

            button.classList.toggle(
                "active",
                button.dataset.type ===
                state.currentType
            );

        });


    updateCategoryOptions();

}


function updateCategoryOptions() {

    const select =
        document.getElementById(
            "categoryInput"
        );


    if (!select) {
        return;
    }


    select.innerHTML = "";


    const firstOption =
        document.createElement(
            "option"
        );


    firstOption.value = "";

    firstOption.textContent =
        "Select category";


    select.appendChild(
        firstOption
    );


    categories[
        state.currentType
    ].forEach(function (category) {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            category;

        option.textContent =
            category;


        select.appendChild(
            option
        );

    });

}


/* =========================================================
   CALCULATIONS
========================================================= */

function getAllTransactionsIncomeLegacy() {

    return state.transactions
        .filter(function (transaction) {

            return (
                transaction.type ===
                "income"
            );

        })
        .reduce(function (
            total,
            transaction
        ) {

            return (
                total +
                Number(
                    transaction.amount
                )
            );

        }, 0);

}


function getAllTransactionsExpensesLegacy() {

    return state.transactions
        .filter(function (transaction) {

            return (
                transaction.type ===
                "expense"
            );

        })
        .reduce(function (
            total,
            transaction
        ) {

            return (
                total +
                Number(
                    transaction.amount
                )
            );

        }, 0);

}


function getAllTransactionsBalanceLegacy() {

    return (
        getAllTransactionsIncomeLegacy() -
        getAllTransactionsExpensesLegacy()
    );

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboardLegacy() {

    const income =
        getAllTransactionsIncomeLegacy();

    const expenses =
        getAllTransactionsExpensesLegacy();

    const balance =
        getAllTransactionsBalanceLegacy();


    setMoney(
        "balanceAmount",
        balance
    );

    setMoney(
        "incomeAmount",
        income
    );

    setMoney(
        "expenseAmount",
        expenses
    );


    const status =
        document.getElementById(
            "balanceStatus"
        );


    if (status) {

        if (balance > 0) {

            status.textContent =
                "Healthy";

        } else if (balance === 0) {

            status.textContent =
                "Balanced";

        } else {

            status.textContent =
                "Over budget";

        }

    }


    renderRecentTransactionsLegacy();

}


function setMoney(id, amount) {

    const element =
        document.getElementById(id);


    if (!element) {
        return;
    }


    if (
        !state.balanceVisible &&
        id === "balanceAmount"
    ) {

        element.textContent =
            "RM •••••";

        return;

    }


    element.textContent =
        formatCurrency(amount);

}


function formatCurrency(amount) {

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


    const currency =
        state.currency || "MYR";


    const symbol =
        symbols[currency] ||
        currency;


    return (
        symbol +
        " " +
        Number(amount).toLocaleString(
            "en-MY",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
    );

}


/* =========================================================
   RECENT TRANSACTIONS
========================================================= */

function renderRecentTransactionsLegacy() {

    const container =
        document.getElementById(
            "recentTransactions"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        state.transactions.length === 0
    ) {

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


        const button =
            document.getElementById(
                "recentEmptyAdd"
            );


        if (button) {

            button.addEventListener(
                "click",
                function () {

                    openTransactionModal(
                        "expense"
                    );

                }
            );

        }


        return;

    }


    state.transactions
        .slice(0, 5)
        .forEach(function (transaction) {

            container.appendChild(
                createTransactionElement(
                    transaction
                )
            );

        });

}


function createTransactionElement(
    transaction
) {

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "transaction-item";


    const icon =
        transaction.type === "income"
            ? "fa-arrow-down"
            : "fa-arrow-up";


    const sign =
        transaction.type === "income"
            ? "+"
            : "-";


    const amountClass =
        transaction.type === "income"
            ? "income"
            : "expense";


    item.innerHTML = `
        <div class="transaction-icon ${amountClass}">
            <i class="fa-solid ${icon}"></i>
        </div>

        <div class="transaction-info">
            <strong>
                ${escapeHTML(
                    transaction.category
                )}
            </strong>

            <span>
                ${escapeHTML(
                    transaction.note ||
                    transaction.date
                )}
            </span>
        </div>

        <div class="transaction-amount ${amountClass}">
            ${sign}${formatCurrency(
                transaction.amount
            )}
        </div>
    `;

    item.addEventListener("click", function () {
        openTransactionView(transaction);
    });


    return item;

}


/* =========================================================
   TRANSACTIONS PAGE
========================================================= */

function renderAllTransactionsLegacy() {

    const container =
        document.getElementById(
            "allTransactions"
        );


    if (!container) {
        return;
    }


    const searchElement =
        document.getElementById(
            "searchInput"
        );

    const typeElement =
        document.getElementById(
            "typeFilter"
        );

    const categoryElement =
        document.getElementById(
            "categoryFilter"
        );

    const dateElement =
        document.getElementById(
            "dateFilter"
        );


    const search =
        searchElement
            ? searchElement.value
                .toLowerCase()
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


    const filtered =
        state.transactions.filter(
            function (transaction) {

                const categoryText =
                    String(
                        transaction.category ||
                        ""
                    ).toLowerCase();

                const noteText =
                    String(
                        transaction.note ||
                        ""
                    ).toLowerCase();


                const matchesSearch =
                    categoryText.includes(
                        search
                    ) ||
                    noteText.includes(
                        search
                    );


                const matchesType =
                    type === "all" ||
                    transaction.type === type;


                const matchesCategory =
                    category === "all" ||
                    transaction.category ===
                    category;


                let matchesDate = true;


                if (
                    dateFilter !== "all"
                ) {

                    const transactionDate =
                        new Date(
                            transaction.date +
                            "T00:00:00"
                        );

                    const today =
                        new Date();


                    if (
                        dateFilter === "today"
                    ) {

                        matchesDate =
                            transactionDate
                                .toDateString() ===
                            today.toDateString();

                    }


                    if (
                        dateFilter === "week"
                    ) {

                        const weekAgo =
                            new Date();

                        weekAgo.setDate(
                            today.getDate() -
                            7
                        );

                        matchesDate =
                            transactionDate >=
                            weekAgo;

                    }


                    if (
                        dateFilter === "month"
                    ) {

                        matchesDate =
                            transactionDate
                                .getMonth() ===
                            today.getMonth() &&
                            transactionDate
                                .getFullYear() ===
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


    if (
        filtered.length === 0
    ) {

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


    filtered.forEach(
        function (transaction) {

            const element =
                createTransactionElement(
                    transaction
                );


            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.className =
                "icon-button transaction-delete";

            deleteButton.type =
                "button";

            deleteButton.innerHTML =
                '<i class="fa-solid fa-trash"></i>';

            deleteButton.setAttribute(
                "aria-label",
                "Delete transaction"
            );


            deleteButton.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    deleteTransaction(
                        transaction.id
                    );

                }
            );


            element.appendChild(
                deleteButton
            );


            container.appendChild(
                element
            );

        }
    );

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


        if (!element) {
            return;
        }


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
        document.getElementById(
            "categoryFilter"
        );


    if (!select) {
        return;
    }


    const current =
        select.value || "all";


    const allCategories = [
        ...categories.expense,
        ...categories.income
    ];


    const unique = [
        ...new Set(
            allCategories
        )
    ];


    select.innerHTML =
        '<option value="all">All categories</option>';


    unique.forEach(
        function (category) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category;

            option.textContent =
                category;


            select.appendChild(
                option
            );

        }
    );


    select.value =
        current;

}


/* =========================================================
   ANALYTICS
========================================================= */

function updateAnalyticsLegacy() {

    const income =
        getAllTransactionsIncomeLegacy();

    const expenses =
        getAllTransactionsExpensesLegacy();

    const savings =
        income - expenses;


    setMoney(
        "analyticsIncome",
        income
    );

    setMoney(
        "analyticsExpenses",
        expenses
    );

    setMoney(
        "analyticsSavings",
        savings
    );


    const count =
        document.getElementById(
            "analyticsCount"
        );


    if (count) {

        count.textContent =
            state.transactions.length;

    }


    renderCategoryChart();

}


function renderCategoryChart() {

    const container =
        document.getElementById(
            "categoryChart"
        );


    if (!container) {
        return;
    }


    const expenses =
        state.transactions.filter(
            function (transaction) {

                return (
                    transaction.type ===
                    "expense"
                );

            }
        );


    if (
        expenses.length === 0
    ) {

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


    expenses.forEach(
        function (transaction) {

            if (
                !totals[
                    transaction.category
                ]
            ) {

                totals[
                    transaction.category
                ] = 0;

            }


            totals[
                transaction.category
            ] += Number(
                transaction.amount
            );

        }
    );


    const total =
        Object.values(totals)
            .reduce(
                function (
                    sum,
                    value
                ) {

                    return sum + value;

                },
                0
            );


    container.innerHTML = "";


    Object.entries(totals)
        .sort(
            function (a, b) {

                return b[1] - a[1];

            }
        )
        .forEach(
            function (
                [category, amount]
            ) {

                const percentage =
                    total === 0
                        ? 0
                        : (
                            amount /
                            total
                        ) * 100;


                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "category-row";


                row.innerHTML = `
                    <div class="category-row-top">
                        <strong>
                            ${escapeHTML(
                                category
                            )}
                        </strong>

                        <span>
                            ${formatCurrency(
                                amount
                            )}
                        </span>
                    </div>

                    <div class="category-bar">
                        <div
                            class="category-bar-fill"
                            style="width:${percentage}%"
                        ></div>
                    </div>
                `;


                container.appendChild(
                    row
                );

            }
        );

}


/* =========================================================
   SETTINGS
========================================================= */

function setupSettings() {

    setupBalanceToggle();


    document
        .querySelectorAll(
            "[data-theme]"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                "[data-theme]"
                            )
                            .forEach(
                                function (item) {

                                    item.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        const theme =
                            button.dataset.theme;


                        applyTheme(
                            theme
                        );


                    }
                );

            }
        );


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
                    primary.value =
                        random[0];
                }


                if (secondary) {
                    secondary.value =
                        random[1];
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
            logoutUser
        );

    }

}


/* =========================================================
   BALANCE TOGGLE
========================================================= */

function setupBalanceToggle() {

    const button =
        document.getElementById(
            "toggleBalanceButton"
        );


    if (!button) {
        return;
    }


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
   USER PROFILE
========================================================= */

function updateUserProfile(user) {

    const name =
        user
            ? (
                user.displayName ||
                "User"
            )
            : "Guest";


    const email =
        user
            ? (
                user.email ||
                ""
            )
            : "";


    const userName =
        document.getElementById(
            "userName"
        );

    const sidebarUserName =
        document.getElementById(
            "sidebarUserName"
        );

    const sidebarUserEmail =
        document.getElementById(
            "sidebarUserEmail"
        );

    const settingsUserName =
        document.getElementById(
            "settingsUserName"
        );

    const settingsUserEmail =
        document.getElementById(
            "settingsUserEmail"
        );


    if (userName) {
        userName.textContent =
            name;
    }


    if (sidebarUserName) {
        sidebarUserName.textContent =
            name;
    }


    if (sidebarUserEmail) {
        sidebarUserEmail.textContent =
            email;
    }


    if (settingsUserName) {
        settingsUserName.textContent =
            name;
    }


    if (settingsUserEmail) {
        settingsUserEmail.textContent =
            email;
    }

}


/* =========================================================
   LOCAL SETTINGS
========================================================= */

function loadLocalSettingsLegacy() {

    const currency =
        localStorage.getItem(
            "expense_currency"
        );


    if (currency) {

        state.currency =
            currency;


        const select =
            document.getElementById(
                "currencySelect"
            );


        if (select) {
            select.value =
                currency;
        }

    }


    const theme =
        localStorage.getItem(
            "expense_theme"
        );


    if (theme) {

        applyTheme(theme);


        document
            .querySelectorAll(
                "[data-theme]"
            )
            .forEach(
                function (button) {

                    button.classList.toggle(
                        "active",
                        button.dataset.theme ===
                        theme
                    );

                }
            );

    }

}


/* =========================================================
   THEME
========================================================= */

function applyTheme(theme) {

    const useDarkTheme =
        theme === "dark" ||
        (
            theme === "system" &&
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
        );


    document.body.classList.toggle(
        "dark",
        useDarkTheme
    );

    if (
        theme === "dark"
    ) {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

    } else if (
        theme === "light"
    ) {

        document.documentElement
            .setAttribute(
                "data-theme",
                "light"
            );

    } else {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

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

    updateCategoryOptions();

    const viewModal = document.getElementById("transactionViewModal");
    const viewedId = document.getElementById("editTransactionButton")?.dataset.transactionId;

    if (viewModal && !viewModal.classList.contains("hidden") && viewedId) {
        const transaction = state.transactions.find(function (item) {
            return item.id === viewedId;
        });

        if (transaction) {
            displayTransactionView(transaction);
        }
    }

    updateGreeting();

}


/* =========================================================
   GREETING
========================================================= */

function updateGreeting() {

    const greetingElement =
        document.getElementById(
            "greeting"
        );


    if (!greetingElement) {
        return;
    }


    const hour =
        new Date().getHours();


    if (hour < 12) {

        greetingElement.textContent =
            "Good morning";

    } else if (hour < 18) {

        greetingElement.textContent =
            "Good afternoon";

    } else {

        greetingElement.textContent =
            "Good evening";

    }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    error = false
) {

    const toast =
        document.getElementById(
            "toast"
        );

    const messageElement =
        document.getElementById(
            "toastMessage"
        );


    if (
        !toast ||
        !messageElement
    ) {

        return;

    }


    if (state.toastTimer) {
        clearTimeout(state.toastTimer);
        state.toastTimer = null;
    }

    messageElement.textContent = message;


    toast.classList.toggle(
        "error",
        Boolean(error)
    );


    toast.classList.add(
        "show"
    );


    state.toastTimer = setTimeout(
        function () {

            toast.classList.remove(
                "show"
            );

            state.toastTimer = null;

        },
        2500
    );

}

function setSyncStatus(status) {
    const resolvedStatus = navigator.onLine ? status : "offline";
    state.syncStatus = resolvedStatus;
    const element = document.getElementById("syncStatus");
    if (!element) return;
    const labels = { saving: "Saving…", synced: "Synced", offline: "Offline", failed: "Sync failed" };
    element.textContent = labels[resolvedStatus] || labels.synced;
    element.className = "sync-status " + resolvedStatus;
}

function showUndoToast(transaction) {
    if (state.pendingUndo?.timer) clearTimeout(state.pendingUndo.timer);
    if (state.toastTimer) {
        clearTimeout(state.toastTimer);
        state.toastTimer = null;
    }
    const toast = document.getElementById("toast"), message = document.getElementById("toastMessage");
    if (!toast || !message) return;
    state.pendingUndo = { transaction };
    message.innerHTML = "Transaction deleted · ";
    const undo = document.createElement("button"); undo.type = "button"; undo.className = "toast-undo"; undo.textContent = "Undo";
    undo.addEventListener("click", async function () {
        const pending = state.pendingUndo; if (!pending || !state.currentUser) return;
        undo.disabled = true; setSyncStatus("saving");
        try {
            const { id, ...data } = pending.transaction;
            await setDoc(doc(db, "users", state.currentUser.uid, "transactions", id), data);
            clearTimeout(pending.timer); state.pendingUndo = null; setSyncStatus("synced"); toast.classList.remove("show"); showToast("Transaction restored");
        } catch (error) { console.error("Failed to restore transaction:", error); setSyncStatus("failed"); showToast("Failed to restore transaction", true); undo.disabled = false; }
    });
    message.appendChild(undo); toast.classList.remove("error"); toast.classList.add("show");
    state.pendingUndo.timer = setTimeout(function () { if (state.pendingUndo?.transaction.id === transaction.id) { state.pendingUndo = null; toast.classList.remove("show"); } }, 5000);
}

function setupSyncStatus() {
    setSyncStatus(navigator.onLine ? "synced" : "offline");
    window.addEventListener("offline", function () { setSyncStatus("offline"); });
    window.addEventListener("online", function () { setSyncStatus("synced"); });
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}

/* =========================================================
   MONTHLY VIEW, BUDGETS, AND GUEST DATA
========================================================= */

function getMonthKey(date) {
    const year = date.getFullYear();
    return year + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function getDateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function monthLabel(monthKey = state.selectedMonth) {
    const parts = String(monthKey).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
        .toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isInSelectedMonth(transaction) {
    return String(transaction.date || "").slice(0, 7) === state.selectedMonth;
}

function getSelectedMonthTransactions() {
    return state.transactions.filter(isInSelectedMonth);
}

function sortTransactionsNewestFirst(a, b) {
    const aDate = String(a.date || "");
    const bDate = String(b.date || "");
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    const aTime = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
    return bTime - aTime || String(b.id).localeCompare(String(a.id));
}

function getIncome() {
    return getSelectedMonthTransactions().filter(function (item) { return item.type === "income"; })
        .reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
}

function getExpenses() {
    return getSelectedMonthTransactions().filter(function (item) { return item.type === "expense"; })
        .reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
}

function updateMonthUI() {
    const label = document.getElementById("selectedMonthLabel");
    const input = document.getElementById("selectedMonthInput");
    if (label) label.textContent = monthLabel();
    if (input) input.value = state.selectedMonth;
}

function setSelectedMonth(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
    state.selectedMonth = monthKey;
    const todayKey = getDateKey(new Date());
    const isCurrentMonth = monthKey === todayKey.slice(0, 7);
    if (isCurrentMonth) {
        state.selectedDate = todayKey;
        state.followingToday = true;
    }
    const monthStart = new Date(monthKey + "-01T00:00:00");
    const maxDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const existingDay = Number(String(state.selectedDate || "").slice(8, 10)) || 1;
    if (!isCurrentMonth) {
        state.selectedDate = monthKey + "-" + String(Math.min(existingDay, maxDay)).padStart(2, "0");
        state.followingToday = false;
    }
    updateMonthUI();
    updateDayUI();
    loadBudget();
    updateAll();
}

function updateDayUI() {
    const input = document.getElementById("selectedDayInput"), label = document.getElementById("selectedDayLabel");
    if (input) { input.min = state.selectedMonth + "-01"; input.max = state.selectedMonth + "-" + String(new Date(Number(state.selectedMonth.slice(0,4)), Number(state.selectedMonth.slice(5,7)), 0).getDate()).padStart(2,"0"); input.value = state.selectedDate; }
    if (label) label.textContent = new Date(state.selectedDate + "T00:00:00").toLocaleDateString("en-US", { day:"numeric", month:"short" });
}

function setSelectedDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey.slice(0,7) !== state.selectedMonth) return;
    state.selectedDate = dateKey;
    state.followingToday = dateKey === getDateKey(new Date()) && state.selectedMonth === getMonthKey(new Date());
    updateDayUI(); renderRecentTransactions();
}

function setupDaySelector() {
    document.getElementById("previousDayButton")?.addEventListener("click", function () { const d = new Date(state.selectedDate + "T00:00:00"); d.setDate(d.getDate()-1); if (getMonthKey(d) === state.selectedMonth) setSelectedDate(getDateKey(d)); });
    document.getElementById("nextDayButton")?.addEventListener("click", function () { const d = new Date(state.selectedDate + "T00:00:00"); d.setDate(d.getDate()+1); if (getMonthKey(d) === state.selectedMonth) setSelectedDate(getDateKey(d)); });
    document.getElementById("selectedDayInput")?.addEventListener("change", function (event) { setSelectedDate(event.target.value); });
    updateDayUI();
}

function setupMonthSelector() {
    document.getElementById("previousMonthButton")?.addEventListener("click", function () {
        const date = new Date(state.selectedMonth + "-01T00:00:00"); date.setMonth(date.getMonth() - 1); setSelectedMonth(getMonthKey(date));
    });
    document.getElementById("nextMonthButton")?.addEventListener("click", function () {
        const date = new Date(state.selectedMonth + "-01T00:00:00"); date.setMonth(date.getMonth() + 1); setSelectedMonth(getMonthKey(date));
    });
    document.getElementById("currentMonthButton")?.addEventListener("click", function () { setSelectedMonth(getMonthKey(new Date())); });
    document.getElementById("selectedMonthInput")?.addEventListener("change", function (event) { setSelectedMonth(event.target.value); });
    updateMonthUI();
}

function scheduleSelectedDateMidnightCheck() {
    const check = function () {
        const now = new Date();
        if (state.followingToday && state.selectedMonth === getMonthKey(now)) {
            const todayKey = getDateKey(now);
            if (state.selectedDate !== todayKey) {
                state.selectedDate = todayKey;
                updateDayUI();
                renderRecentTransactions();
            }
        }
        const next = new Date(); next.setHours(24, 0, 2, 0);
        setTimeout(check, next.getTime() - Date.now());
    };
    check();
}

function loadBudget() {
    if (state.unsubscribeBudget) { state.unsubscribeBudget(); state.unsubscribeBudget = null; }
    state.currentBudget = null;
    updateBudgetUI();
    if (!state.currentUser || state.guestMode) return;
    const budgetRef = doc(db, "users", state.currentUser.uid, "budgets", state.selectedMonth);
    state.unsubscribeBudget = onSnapshot(budgetRef, function (snapshot) {
        state.currentBudget = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
        updateBudgetUI();
    }, function (error) { console.error("Budget load failed:", error); showToast("Could not load budget", true); });
}

function updateBudgetUILegacy() {
    const empty = document.getElementById("budgetEmpty"), details = document.getElementById("budgetDetails"), button = document.getElementById("setBudgetButton");
    const categorySection = document.getElementById("categoryBudgetSection"), categoryList = document.getElementById("categoryBudgetList");
    if (!empty || !details || !button || !categorySection || !categoryList) return;
    const budgetCategories = getBudgetCategories();
    const hasTotal = isPositiveAmount(state.currentBudget?.amount);
    const hasCategories = Object.keys(getCurrentCategoryBudgets()).length > 0;
    const categorySpending = getCategorySpending();
    const visibleCategories = budgetCategories.filter(function (category) {
        return isPositiveAmount(getCurrentCategoryBudgets()[category]) || isPositiveAmount(categorySpending[category]);
    });

    button.textContent = hasTotal || hasCategories ? "Edit Budget" : "Set Budget";
    empty.classList.toggle("hidden", hasTotal || hasCategories);
    details.classList.toggle("hidden", !hasTotal);
    categorySection.classList.toggle("hidden", visibleCategories.length === 0);

    if (hasTotal) {
        const amount = Number(state.currentBudget.amount), spent = getExpenses(), remaining = amount - spent, percentage = Math.round((spent / amount) * 100);
        document.getElementById("budgetProgress").textContent = formatCurrency(spent) + " / " + formatCurrency(amount);
        document.getElementById("budgetUsage").textContent = percentage + "% used";
        document.getElementById("budgetProgressBar").style.width = Math.min(percentage, 100) + "%";
        document.querySelector(".budget-progress")?.classList.toggle("over", remaining < 0);
        document.getElementById("budgetRemaining").textContent = remaining >= 0 ? formatCurrency(remaining) + " remaining" : formatCurrency(Math.abs(remaining)) + " over budget";
    }

    if (!visibleCategories.length) return;
    const categoryBudgets = getCurrentCategoryBudgets();
    const sorted = visibleCategories.map(function (category) {
        const spent = Number(categorySpending[category] || 0), amount = Number(categoryBudgets[category] || 0);
        const ratio = amount ? spent / amount : -1;
        return { category, spent, amount, ratio, over: amount > 0 && spent > amount };
    }).sort(function (a, b) {
        return Number(b.over) - Number(a.over) || b.ratio - a.ratio || Number(b.amount > 0) - Number(a.amount > 0) || b.spent - a.spent || a.category.localeCompare(b.category);
    });
    document.getElementById("categoryBudgetHint").textContent = monthLabel();
    categoryList.innerHTML = sorted.map(function (item) {
        const percentage = item.amount ? Math.round(item.ratio * 100) : null;
        const status = item.amount ? (item.over ? formatCurrency(item.spent - item.amount) + " over budget" : formatCurrency(item.amount - item.spent) + " remaining") : "No budget set";
        return '<div class="category-budget-row' + (item.over ? ' over' : '') + '"><div class="category-budget-row-top"><strong>' + escapeHTML(item.category) + '</strong><span>' + (item.amount ? formatCurrency(item.spent) + ' / ' + formatCurrency(item.amount) : formatCurrency(item.spent) + ' spent') + '</span></div>' + (item.amount ? '<div class="category-progress"><span style="width:' + Math.min(percentage, 100) + '%"></span></div><div class="category-budget-status">' + percentage + '% used · ' + status + '</div>' : '<div class="category-budget-status">' + status + '</div>') + '</div>';
    }).join("");
}

function isPositiveAmount(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }

function getCurrentCategoryBudgets() {
    const values = state.currentBudget?.categories;
    if (!values || typeof values !== "object" || Array.isArray(values)) return {};
    return Object.fromEntries(Object.entries(values).filter(function (entry) { return isPositiveAmount(entry[1]); }));
}

function getBudgetCategories() { return categories.expense.slice(); }

function getCategorySpending() {
    return getSelectedMonthTransactions().filter(function (item) { return item.type === "expense"; })
        .reduce(function (totals, item) { const category = item.category || "Other"; totals[category] = (totals[category] || 0) + Number(item.amount || 0); return totals; }, {});
}

function setupBudgetLegacy() {
    const modal = document.getElementById("budgetModal");
    const close = function () { modal?.classList.add("hidden"); };
    document.getElementById("setBudgetButton")?.addEventListener("click", function () {
        document.getElementById("budgetModalTitle").textContent = state.currentBudget ? "Edit Budget" : "Set Budget";
        document.getElementById("budgetMonthName").textContent = monthLabel();
        document.getElementById("budgetAmountInput").value = state.currentBudget?.amount || "";
        document.getElementById("budgetCurrencyPrefix").textContent = (formatCurrency(0).match(/^\S+/) || [state.currency])[0];
        renderBudgetCategoryInputs();
        modal?.classList.remove("hidden"); document.getElementById("budgetAmountInput")?.focus();
    });
    document.getElementById("closeBudgetModal")?.addEventListener("click", close);
    document.getElementById("cancelBudgetButton")?.addEventListener("click", close);
    document.getElementById("budgetForm")?.addEventListener("submit", async function (event) {
        event.preventDefault(); const rawAmount = document.getElementById("budgetAmountInput").value.trim(); const amount = rawAmount ? Number(rawAmount) : null;
        if (!state.currentUser || state.guestMode) { showToast("Please login to save a budget", true); return; }
        if (rawAmount && !isPositiveAmount(amount)) { showToast("Enter a valid budget amount", true); return; }
        const invalidCategory = Array.from(document.querySelectorAll("[data-budget-category]")).some(function (input) { return input.value.trim() && !isPositiveAmount(Number(input.value)); });
        if (invalidCategory) { showToast("Category budgets must be greater than zero", true); return; }
        const categoryBudgets = readBudgetCategoryInputs();
        if (rawAmount === "" && Object.keys(categoryBudgets).length === 0) { showToast("Set a total or category budget", true); return; }
        const [year, month] = state.selectedMonth.split("-").map(Number);
        const budgetData = { year, month, updatedAt: serverTimestamp(), categories: categoryBudgets };
        if (rawAmount) budgetData.amount = amount;
        else if (state.currentBudget?.amount) budgetData.amount = state.currentBudget.amount;
        const budgetRef = doc(db, "users", state.currentUser.uid, "budgets", state.selectedMonth);
        try {
            if (state.currentBudget) await updateDoc(budgetRef, budgetData);
            else await setDoc(budgetRef, budgetData);
            close(); showToast("Budget saved");
        }
        catch (error) { console.error("Budget save failed:", error); showToast("Failed to save budget", true); }
    });
}

function renderBudgetCategoryInputsLegacy() {
    const container = document.getElementById("budgetCategoryInputs");
    if (!container) return;
    const categoryBudgets = getCurrentCategoryBudgets();
    const currency = (formatCurrency(0).match(/^\S+/) || [state.currency])[0];
    container.innerHTML = getBudgetCategories().map(function (category) {
        const value = categoryBudgets[category] || "";
        return '<label class="budget-category-input-row"><span>' + escapeHTML(category) + '</span><span class="budget-input-wrap"><i>' + escapeHTML(currency) + '</i><input type="number" min="0.01" step="0.01" inputmode="decimal" data-budget-category="' + escapeHTML(category) + '" value="' + escapeHTML(value) + '" aria-label="' + escapeHTML(category) + ' budget"></span></label>';
    }).join("");
    container.querySelectorAll("[data-budget-category]").forEach(function (input) { input.addEventListener("input", updateCategoryBudgetTotal); });
    updateCategoryBudgetTotal();
}

function readBudgetCategoryInputsLegacy() {
    const budgets = {};
    document.querySelectorAll("[data-budget-category]").forEach(function (input) {
        const raw = input.value.trim(); if (!raw) return;
        const amount = Number(raw);
        if (isPositiveAmount(amount)) budgets[input.dataset.budgetCategory] = amount;
    });
    return budgets;
}

function updateCategoryBudgetTotalLegacy() {
    const total = Object.values(readBudgetCategoryInputs()).reduce(function (sum, amount) { return sum + amount; }, 0);
    const target = document.getElementById("categoryBudgetTotal");
    if (target) target.textContent = "Category budgets total: " + (total ? formatCurrency(total) : "—");
}

function renderRecentTransactions() {
    const container = document.getElementById("recentTransactions"); if (!container) return;
    const items = getSelectedMonthTransactions().filter(function (item) { return item.date === state.selectedDate; }).sort(sortTransactionsNewestFirst); container.innerHTML = "";
    if (!items.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-receipt"></i></div><h4>No transactions for this day</h4><p>Add a transaction to get started.</p><button class="primary-button" id="recentEmptyAdd" type="button"><i class="fa-solid fa-plus"></i> Add transaction</button></div>'; document.getElementById("recentEmptyAdd")?.addEventListener("click", function () { openTransactionModal("expense"); }); return; }
    items.slice(0, 5).forEach(function (item) { container.appendChild(createTransactionElement(item)); });
}

function renderAllTransactions() {
    const container = document.getElementById("allTransactions"); if (!container) return;
    const search = (document.getElementById("searchInput")?.value || "").toLowerCase(), type = document.getElementById("typeFilter")?.value || "all", category = document.getElementById("categoryFilter")?.value || "all", filter = document.getElementById("dateFilter")?.value || "selected";
    const today = new Date();
    const items = state.transactions.filter(function (item) {
        const matchesText = String(item.category || "").toLowerCase().includes(search) || String(item.note || "").toLowerCase().includes(search);
        const matchesType = type === "all" || item.type === type, matchesCategory = category === "all" || item.category === category;
        let matchesDate = true; const itemDate = new Date(String(item.date || "") + "T00:00:00");
        if (filter === "selected") matchesDate = isInSelectedMonth(item);
        if (filter === "today") matchesDate = itemDate.toDateString() === today.toDateString();
        if (filter === "week") { const cutoff = new Date(); cutoff.setDate(today.getDate() - 7); matchesDate = itemDate >= cutoff; }
        if (filter === "month") matchesDate = itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
        return matchesText && matchesType && matchesCategory && matchesDate;
    }).sort(sortTransactionsNewestFirst);
    container.innerHTML = "";
    if (!items.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-receipt"></i></div><h4>No transactions for ' + escapeHTML(filter === "selected" ? monthLabel() : "this filter") + '</h4></div>'; return; }
    items.forEach(function (item) { const el = createTransactionElement(item); const button = document.createElement("button"); button.className = "icon-button transaction-delete"; button.type = "button"; button.innerHTML = '<i class="fa-solid fa-trash"></i>'; button.setAttribute("aria-label", "Delete transaction"); button.addEventListener("click", function (event) { event.stopPropagation(); deleteTransaction(item.id); }); el.appendChild(button); container.appendChild(el); });
}

function updateAnalytics() {
    const income = getIncome(), expenses = getExpenses();
    setMoney("analyticsIncome", income); setMoney("analyticsExpenses", expenses); setMoney("analyticsSavings", income - expenses);
    const count = document.getElementById("analyticsCount"); if (count) count.textContent = getSelectedMonthTransactions().length;
    renderSpendingBreakdown();
}

function renderSpendingBreakdown() {
    const expenses = getSelectedMonthTransactions().filter(function (item) { return item.type === "expense"; });
    const totals = expenses.reduce(function (all, item) { const key = item.category || "Other"; all[key] = (all[key] || 0) + Number(item.amount || 0); return all; }, {});
    const entries = Object.entries(totals).sort(function (a, b) { return b[1] - a[1]; }), total = entries.reduce(function (sum, item) { return sum + item[1]; }, 0);
    const empty = document.getElementById("spendingEmpty"), content = document.getElementById("spendingContent");
    if (empty) empty.classList.toggle("hidden", total > 0); if (content) content.classList.toggle("hidden", total <= 0);
    document.getElementById("totalSpentSummary").textContent = total ? formatCurrency(total) : "—";
    document.getElementById("expenseCountSummary").textContent = expenses.length;
    document.getElementById("topCategorySummary").textContent = entries.length ? entries[0][0] : "—";
    document.getElementById("topCategoryAmount").textContent = entries.length ? formatCurrency(entries[0][1]) + " · " + Math.round(entries[0][1] / total * 100) + "%" : "";
    if (!total || typeof Chart === "undefined") { if (state.spendingChart) { state.spendingChart.destroy(); state.spendingChart = null; } return; }
    document.getElementById("chartTotal").textContent = formatCurrency(total);
    const colors = ["#7c5cfc", "#5cc8ff", "#16a085", "#f6a64b", "#e98175", "#5975d9", "#ae70c9", "#84b66a"];
    const legend = document.getElementById("spendingLegend"); legend.innerHTML = entries.map(function (entry, index) { const percent = Math.round(entry[1] / total * 100); return '<div class="legend-item"><span class="legend-dot" style="background:' + colors[index % colors.length] + '"></span><span>' + escapeHTML(entry[0]) + '</span><strong>' + formatCurrency(entry[1]) + '<small> · ' + percent + '%</small></strong></div>'; }).join("");
    if (state.spendingChart) state.spendingChart.destroy();
    state.spendingChart = new Chart(document.getElementById("spendingChart"), { type: "doughnut", data: { labels: entries.map(function (entry) { return entry[0]; }), datasets: [{ data: entries.map(function (entry) { return entry[1]; }), backgroundColor: entries.map(function (_, index) { return colors[index % colors.length]; }), borderWidth: 0, hoverOffset: 5 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return ctx.label + ": " + formatCurrency(ctx.raw); } } } } } });
}

function updateDashboard() {
    const income = getIncome(), expenses = getExpenses(), balance = income - expenses;
    setMoney("balanceAmount", balance); setMoney("incomeAmount", income); setMoney("expenseAmount", expenses);
    const status = document.getElementById("balanceStatus"); if (status) status.textContent = balance > 0 ? "Healthy" : balance === 0 ? "Balanced" : "Over budget";
    updateBudgetUI(); renderRecentTransactions();
}

function persistGuestTransactions() { localStorage.setItem("expense_guest_transactions", JSON.stringify(state.transactions)); }
function loadGuestTransactions() { try { const data = JSON.parse(localStorage.getItem("expense_guest_transactions") || "[]"); return Array.isArray(data) ? data.filter(function (item) { return item && item.id; }).sort(sortTransactionsNewestFirst) : []; } catch (_) { return []; } }

function setupGuestImport() {
    const modal = document.getElementById("guestImportModal"), close = function () { modal?.classList.add("hidden"); };
    document.getElementById("skipGuestImportButton")?.addEventListener("click", close);
    document.getElementById("confirmGuestImportButton")?.addEventListener("click", async function () {
        const guestItems = loadGuestTransactions(); if (!state.currentUser || !guestItems.length) return close();
        const button = document.getElementById("confirmGuestImportButton"); button.disabled = true;
        try { await Promise.all(guestItems.map(function (item) { const { id, ...data } = item; return setDoc(doc(db, "users", state.currentUser.uid, "transactions", "guest_" + id), { ...data, createdAt: serverTimestamp() }); })); localStorage.removeItem("expense_guest_transactions"); close(); showToast("Guest transactions imported"); }
        catch (error) { console.error("Guest import failed:", error); showToast("Guest import failed. Your local data is safe.", true); }
        finally { button.disabled = false; }
    });
}

function setupAppearancePersistence() {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", function () { if ((localStorage.getItem("expense_appearance") || "system") === "system") { applyTheme("system"); renderSpendingBreakdown(); } });
    document.getElementById("saveAppearanceButton")?.addEventListener("click", function () {
        const selected = document.querySelector("[data-theme].active")?.dataset.theme || "system";
        const primary = document.getElementById("primaryColor")?.value;
        const secondary = document.getElementById("secondaryColor")?.value;
        localStorage.setItem("expense_appearance", selected);
        if (primary) localStorage.setItem("expense_primary_color", primary);
        if (secondary) localStorage.setItem("expense_secondary_color", secondary);
        applyTheme(selected); applySavedAccentColors(); renderSpendingBreakdown(); showToast("Appearance saved");
    });
}

function applySavedAccentColors() {
    const primary = localStorage.getItem("expense_primary_color");
    const secondary = localStorage.getItem("expense_secondary_color");
    const primaryInput = document.getElementById("primaryColor"), secondaryInput = document.getElementById("secondaryColor");
    if (primary && /^#[0-9a-f]{6}$/i.test(primary)) { document.documentElement.style.setProperty("--primary", primary); if (primaryInput) primaryInput.value = primary; }
    if (secondary && /^#[0-9a-f]{6}$/i.test(secondary)) { document.documentElement.style.setProperty("--secondary", secondary); if (secondaryInput) secondaryInput.value = secondary; }
}

function loadLocalSettings() {
    const currency = localStorage.getItem("expense_currency");
    if (currency) { state.currency = currency; const select = document.getElementById("currencySelect"); if (select) select.value = currency; }
    const appearance = localStorage.getItem("expense_appearance") || localStorage.getItem("expense_theme") || "system";
    applyTheme(appearance);
    applySavedAccentColors();
    document.querySelectorAll("[data-theme]").forEach(function (button) { button.classList.toggle("active", button.dataset.theme === appearance); });
}

document.addEventListener("DOMContentLoaded", function () { document.getElementById("dateFilter").value = "selected"; setupSyncStatus(); setupMonthSelector(); setupDaySelector(); scheduleSelectedDateMidnightCheck(); setupBudget(); setupGuestImport(); setupAppearancePersistence(); updateAll(); });
onAuthStateChanged(auth, function (user) {
    if (!user) { if (state.unsubscribeBudget) { state.unsubscribeBudget(); state.unsubscribeBudget = null; } state.currentBudget = null; updateBudgetUI(); return; }
    loadBudget(); const guestItems = loadGuestTransactions();
    if (guestItems.length) { document.getElementById("guestImportMessage").textContent = "You have " + guestItems.length + " transaction" + (guestItems.length === 1 ? "" : "s") + " saved on this device. Would you like to add them to your account?"; document.getElementById("guestImportModal")?.classList.remove("hidden"); }
});

/* Budget page: one category at a time, no dashboard-owned budget UI. */
function setupBudget() {
    const source = document.querySelector("#dashboardPage .budget-card");
    const target = document.getElementById("budgetPageContent");
    if (source && target) target.appendChild(source);
    const card = target?.querySelector(".budget-card");
    if (card) card.insertAdjacentHTML("beforeend", '<button id="addCategoryBudgetButton" class="secondary-button budget-add-category" type="button">+ Add Category Budget</button>');
    const modal = document.getElementById("budgetModal");
    if (!modal) return;
    modal.innerHTML = '<div class="modal-card budget-modal-card"><div class="modal-header"><div><span class="eyebrow">MONTHLY PLAN</span><h2 id="budgetModalTitle">Budget</h2><p id="budgetMonthName"></p></div><button id="closeBudgetModal" class="icon-button" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><form id="budgetForm"><div class="form-group"><label for="budgetAmountInput">Amount</label><div class="amount-input"><span id="budgetCurrencyPrefix">RM</span><input id="budgetAmountInput" type="number" min="0.01" step="0.01" required></div></div><div id="budgetCategoryField" class="form-group"><label for="budgetCategorySelect">Category</label><select id="budgetCategorySelect" class="form-input"><option value="">Select category</option></select></div><div class="modal-actions"><button id="cancelBudgetButton" class="secondary-button" type="button">Cancel</button><button id="saveBudgetBtn" class="primary-button" type="submit">Save</button></div></form></div>';
    let mode = "category", editingCategory = null;
    const close = function () { modal.classList.add("hidden"); };
    const open = function (nextMode, category = null) {
        mode = nextMode; editingCategory = category;
        const categoryField = document.getElementById("budgetCategoryField"), select = document.getElementById("budgetCategorySelect");
        document.getElementById("budgetModalTitle").textContent = mode === "total" ? (isPositiveAmount(state.currentBudget?.amount) ? "Edit Total Budget" : "Set Total Budget") : (category ? "Edit Category Budget" : "Add Category Budget");
        document.getElementById("budgetMonthName").textContent = monthLabel();
        document.getElementById("budgetCurrencyPrefix").textContent = (formatCurrency(0).match(/^\S+/) || [state.currency])[0];
        categoryField.classList.toggle("hidden", mode === "total");
        select.innerHTML = '<option value="">Select category</option>' + getBudgetCategories().map(function (name) { return '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>'; }).join("");
        if (category) { select.value = category; select.disabled = true; }
        else select.disabled = false;
        document.getElementById("budgetAmountInput").value = mode === "total" ? (state.currentBudget?.amount || "") : (category ? getCurrentCategoryBudgets()[category] || "" : "");
        modal.classList.remove("hidden"); document.getElementById("budgetAmountInput").focus();
    };
    card?.querySelector("#setBudgetButton")?.addEventListener("click", function () { if (state.guestMode || !state.currentUser) return showToast("Sign in to manage budgets", true); open("total"); });
    document.getElementById("addCategoryBudgetButton")?.addEventListener("click", function () { if (state.guestMode || !state.currentUser) return showToast("Sign in to manage budgets", true); open("category"); });
    document.getElementById("closeBudgetModal").addEventListener("click", close); document.getElementById("cancelBudgetButton").addEventListener("click", close);
    document.getElementById("budgetForm").addEventListener("submit", async function (event) {
        event.preventDefault(); const amount = Number(document.getElementById("budgetAmountInput").value); const category = document.getElementById("budgetCategorySelect").value;
        if (!isPositiveAmount(amount)) return showToast("Please enter a valid budget amount.", true);
        if (mode === "category" && (!category || !getBudgetCategories().includes(category))) return showToast("Please select a category.", true);
        if (!state.currentUser || state.guestMode || !/^\d{4}-\d{2}$/.test(state.selectedMonth)) return showToast("Sign in to manage budgets", true);
        const [year, month] = state.selectedMonth.split("-").map(Number), ref = doc(db, "users", state.currentUser.uid, "budgets", state.selectedMonth);
        const payload = mode === "total" ? { amount, year, month, updatedAt: serverTimestamp() } : { ["categories." + category]: amount, year, month, updatedAt: serverTimestamp() };
        try { if (state.currentBudget) await updateDoc(ref, payload); else await setDoc(ref, mode === "total" ? payload : { categories: { [category]: amount }, year, month, updatedAt: serverTimestamp() }); close(); showToast("Budget saved"); }
        catch (error) { console.error("Failed to save budget:", error); showToast("Failed to save budget", true); }
    });
    target?.addEventListener("click", async function (event) {
        const edit = event.target.closest("[data-edit-budget]"); const remove = event.target.closest("[data-delete-budget]");
        if (edit) open("category", edit.dataset.editBudget);
        if (remove && state.currentUser && !state.guestMode) {
            const category = remove.dataset.deleteBudget, ref = doc(db, "users", state.currentUser.uid, "budgets", state.selectedMonth);
            try { await updateDoc(ref, { ["categories." + category]: deleteField(), updatedAt: serverTimestamp() }); showToast("Category budget deleted"); }
            catch (error) { console.error("Failed to delete budget:", error); showToast("Failed to delete budget", true); }
        }
    });
}

function updateBudgetUI() {
    const card = document.querySelector("#budgetPageContent .budget-card"), pageMonth = document.getElementById("budgetPageMonth");
    if (pageMonth) pageMonth.textContent = monthLabel();
    if (!card) return;
    const button = card.querySelector("#setBudgetButton"), empty = card.querySelector("#budgetEmpty"), details = card.querySelector("#budgetDetails"), section = card.querySelector("#categoryBudgetSection"), list = card.querySelector("#categoryBudgetList");
    if (state.guestMode || !state.currentUser) { empty.classList.remove("hidden"); empty.innerHTML = '<strong>Sign in to manage budgets</strong><span>Budgets sync securely across your devices.</span>'; details.classList.add("hidden"); section.classList.add("hidden"); button.textContent = "Set Total Budget"; return; }
    const categoriesMap = getCurrentCategoryBudgets(), categorySpending = getCategorySpending(), entries = Object.keys(categoriesMap).map(function (category) { const budget = categoriesMap[category], spent = Number(categorySpending[category] || 0), percent = Math.round(spent / budget * 100); return { category, budget, spent, percent, over: spent > budget }; }).sort(function (a,b) { return Number(b.over)-Number(a.over) || b.percent-a.percent || a.category.localeCompare(b.category); });
    const hasTotal = isPositiveAmount(state.currentBudget?.amount); button.textContent = hasTotal ? "Edit Total Budget" : "Set Total Budget"; empty.classList.toggle("hidden", hasTotal || entries.length); details.classList.toggle("hidden", !hasTotal); section.classList.toggle("hidden", !entries.length);
    if (hasTotal) { const amount = Number(state.currentBudget.amount), spent = getExpenses(), remaining = amount-spent, percent = Math.round(spent/amount*100); card.querySelector("#budgetProgress").textContent = formatCurrency(spent)+" / "+formatCurrency(amount); card.querySelector("#budgetUsage").textContent = percent+"% used"; card.querySelector("#budgetProgressBar").style.width = Math.min(percent,100)+"%"; card.querySelector("#budgetRemaining").textContent = remaining >= 0 ? formatCurrency(remaining)+" remaining" : formatCurrency(-remaining)+" over budget"; }
    if (entries.length) { section.querySelector("#categoryBudgetHint").textContent = monthLabel(); list.innerHTML = entries.map(function (item) { const status = item.over ? formatCurrency(item.spent-item.budget)+" over budget" : formatCurrency(item.budget-item.spent)+" remaining"; return '<div class="category-budget-row'+(item.over?' over':'')+'"><div class="category-budget-row-top"><strong>'+escapeHTML(item.category)+'</strong><span>'+formatCurrency(item.spent)+' / '+formatCurrency(item.budget)+'</span></div><div class="category-progress"><span style="width:'+Math.min(item.percent,100)+'%"></span></div><div class="category-budget-status">'+item.percent+'% used · '+status+'</div><div class="budget-row-actions"><button type="button" class="text-button" data-edit-budget="'+escapeHTML(item.category)+'">Edit</button><button type="button" class="text-button budget-delete" data-delete-budget="'+escapeHTML(item.category)+'">Delete</button></div></div>'; }).join(""); }
}
