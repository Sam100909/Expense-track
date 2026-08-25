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
    deleteDoc,
    updateDoc,
    doc,
    getDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    setDoc,
    deleteField,
    waitForPendingWrites
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
    nickname: "",
    unsubscribeTransactions: null,
    guestMode: false,
    authResolved: false,
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
    hasPendingWrites: false,
    syncFailed: false,
    transactionSubmitting: false,
    pendingWriteCheck: 0,
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
        "Car Maintenance",
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
    setupNavigation();
    setupTransactionModal();
    setupTransactionView();
    setupHistoryNavigation();
    setupQuickActions();
    setupFilters();
    setupSettings();

    loadLocalSettings();
    showApp();
    updateAll();
    applyLanguage(getLanguage());
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { updateTodayDateLabel(); updateGreeting(); }
    });

});


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, function (user) {

    state.authResolved = true;

    if (user) {

        console.log("User signed in:", user);

        state.currentUser = user;
        state.guestMode = false;
        state.nickname = "";

        updateUserProfile(user);
        loadNickname(user);

        completeStartup("app");

        loadFirestoreTransactions(user.uid);

    } else {

        console.log("No user signed in.");

        if (!state.guestMode) {

            state.currentUser = null;
            state.nickname = "";
            state.transactions = [];

            if (state.unsubscribeTransactions) {
                state.unsubscribeTransactions();
                state.unsubscribeTransactions = null;
            }

            updateUserProfile(null);
            completeStartup("login");

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

            completeStartup("app");

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

            completeStartup("app");

            updateAll();

            showToast("Guest mode");

        }
    );

}


/* =========================================================
   SHOW / HIDE
========================================================= */

function completeStartup(destination) {
    if (destination === "app") {
        hideLogin();
        showApp();
    } else {
        hideApp();
        showLogin();
    }

    document.body.classList.remove("auth-pending");
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
            { includeMetadataChanges: true },
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

                updatePendingWriteStatus(snapshot.metadata.hasPendingWrites);
                updateAll();

            },
            function (error) {

                console.error(
                    "Firestore error:",
                    error
                );

                state.syncFailed = true;
                refreshSyncStatus();

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


    const form = document.getElementById("transactionForm");
    if (!amountInput || !categoryInput || !dateInput || !noteInput || !form) {
        showToast("Transaction form is unavailable. Please reopen it.", true);
        return;
    }

    if (state.transactionSubmitting) return;


    const amount =
        Number(amountInput.value);

    const category =
        categoryInput.value;

    const date =
        dateInput.value;

    const note =
        noteInput.value.trim();


    if (!Number.isFinite(amount) || amount <= 0) {

        showToast(
            "Please enter a valid amount",
            true
        );

        amountInput.focus();
        return;

    }


    if (!category) {

        showToast(
            "Please select a category",
            true
        );

        categoryInput.focus();
        return;

    }


    if (!date) {

        showToast(
            "Please select a date",
            true
        );

        dateInput.focus();
        return;

    }

    const transactionData = {
        type: state.currentType,
        amount: amount,
        category: category,
        date: date,
        note: note
    };

    setTransactionSubmitting(true);

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

            resetTransactionForm();
            closeTransactionModal();
            updateAll();
            showToast("Transaction updated");
            setTransactionSubmitting(false);
            return;

        }

        if (!state.currentUser) {
            showToast("Please login first", true);
            setTransactionSubmitting(false);
            return;
        }

        try {

            const writePromise = updateDoc(
                doc(
                    db,
                    "users",
                    state.currentUser.uid,
                    "transactions",
                    id
                ),
                transactionData
            );

            queueTransactionWrite(writePromise, "Failed to update transaction");
            if (!navigator.onLine) {
                resetTransactionForm();
                closeTransactionModal();
                updateAll();
                showToast("Transaction saved offline and will sync when you reconnect");
                setTransactionSubmitting(false);
                return;
            }
            await writePromise;
            resetTransactionForm();
            closeTransactionModal();
            updateAll();
            showToast("Transaction updated");

        } catch (error) {

            console.error("Failed to update transaction:", error);
            showToast("Failed to update transaction. Your changes are still in the form.", true);

        }

        setTransactionSubmitting(false);

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

            resetTransactionForm();
            closeTransactionModal();
            updateAll();

            showToast(
                "Transaction added"
            );

            setTransactionSubmitting(false);
            return;

        }

        showToast(
            "Please login first",
            true
        );

        setTransactionSubmitting(false);

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


        const transactionRef = doc(transactionsRef);
        const writePromise = setDoc(
            transactionRef,
            {
                ...transactionData,
                createdAt:
                    serverTimestamp()
            }
        );

        queueTransactionWrite(writePromise, "Failed to save transaction");
        if (!navigator.onLine) {
            resetTransactionForm();
            closeTransactionModal();
            updateAll();
            showToast("Transaction saved offline and will sync when you reconnect");
            setTransactionSubmitting(false);
            return;
        }
        await writePromise;
        resetTransactionForm();
        closeTransactionModal();
        updateAll();

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
            "Failed to save transaction. Your entry is still in the form.",
            true
        );

    }

    setTransactionSubmitting(false);

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
        const writePromise = deleteDoc(doc(db, "users", state.currentUser.uid, "transactions", id));
        queueTransactionWrite(writePromise, "Failed to delete transaction");
        showUndoToast(transaction);

    } catch (error) {

        state.transactions.unshift(transaction); updateAll(); state.syncFailed = true; refreshSyncStatus(); console.error(
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
        .querySelectorAll(".nav-item, .mobile-nav-item")
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
                ) ||
                element.classList.contains(
                    "mobile-nav-item"
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


    const pageOrder = ["dashboard", "transactions", "budget", "converter", "settings"];
    const previousIndex = pageOrder.indexOf(state.currentPage), nextIndex = pageOrder.indexOf(pageName);
    state.currentPage = pageName;
    updateDashboardControlsVisibility();

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
    target.style.setProperty("--page-enter-x", (nextIndex >= previousIndex ? "10px" : "-10px"));


    document
        .querySelectorAll(".nav-item, .mobile-nav-item")
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

    const mobileAdd =
        document.getElementById(
            "mobileAddButton"
        );


    if (mobileAdd) {

        mobileAdd.addEventListener(
            "click",
            function () {

                openTransactionModal(
                    "expense"
                );

            }
        );

    }

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

    if (closeButton) {

        closeButton.addEventListener(
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

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && state.activeModal === "transaction") closeTransactionModal();
    });


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
    const submitButton = document.getElementById("transactionSubmitButton");

    if (title) title.textContent = getTransactionModalTitle();

    if (submitButton) {
        submitButton.innerHTML = transaction
            ? '<i class="fa-solid fa-check"></i> Save Changes'
            : '<i class="fa-solid fa-check"></i> ' + (state.currentType === "income" ? "Add Income" : "Add Expense");
    }

    document.getElementById("transactionViewModal")?.classList.add("hidden");
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
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
    document.body.classList.remove("modal-open");
    setTransactionSubmitting(false);

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

    const submitButton = document.getElementById("transactionSubmitButton");
    if (submitButton && !state.editingTransactionId && !state.transactionSubmitting) {
        submitButton.innerHTML = '<i class="fa-solid fa-check"></i> ' + (state.currentType === "income" ? "Add Income" : "Add Expense");
    }
    const title = document.querySelector("#transactionModal h2");
    if (title && !document.getElementById("transactionModal")?.classList.contains("hidden")) title.textContent = getTransactionModalTitle();

}

function getTransactionModalTitle() {
    const income = state.currentType === "income";
    if (getLanguage() === "zh") return state.editingTransactionId ? (income ? "編輯收入" : "編輯支出") : (income ? "新增收入" : "新增支出");
    return state.editingTransactionId ? (income ? "Edit Income" : "Edit Expense") : (income ? "Add Income" : "Add Expense");
}


function updateCategoryOptions() {

    const select =
        document.getElementById(
            "categoryInput"
        );


    if (!select) {
        return;
    }


    const selectedCategory = select.value;
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

    if (categories[state.currentType].includes(selectedCategory)) {
        select.value = selectedCategory;
    }

}

function setTransactionSubmitting(isSubmitting) {
    state.transactionSubmitting = isSubmitting;
    const submitButton = document.getElementById("transactionSubmitButton");
    const form = document.getElementById("transactionForm");
    if (!submitButton || !form) return;

    submitButton.disabled = isSubmitting;
    form.querySelectorAll("input, select, textarea, .type-button").forEach(function (field) {
        field.disabled = isSubmitting;
    });
    form.setAttribute("aria-busy", String(isSubmitting));
    if (isSubmitting) {
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    } else if (state.editingTransactionId) {
        submitButton.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    } else {
        submitButton.innerHTML = '<i class="fa-solid fa-check"></i> ' + (state.currentType === "income" ? "Add Income" : "Add Expense");
    }
}

function resetTransactionForm() {
    const form = document.getElementById("transactionForm");
    if (form) form.reset();
    setTransactionType("expense");
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
            : transaction.category === "Car Maintenance"
                ? "fa-screwdriver-wrench"
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
        "dateFilter",
        "selectedMonthInput"
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

    document.getElementById("toggleTransactionFilters")?.addEventListener("click", function () {
        const advanced = document.getElementById("transactionAdvancedFilters");
        if (!advanced) return;
        const open = advanced.classList.toggle("hidden") === false;
        this.setAttribute("aria-expanded", String(open));
        this.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> ' + (open ? "Hide filters" : "Search");
    });

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
    setupNicknameSetting();


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
                        renderSpendingBreakdown();


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
                applyLanguage(language.value);


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
                    ["#36383D", "#72757C"],
                    ["#242628", "#5F6264"],
                    ["#3F4244", "#858889"],
                    ["#4A4D50", "#AEB0B0"],
                    ["#2C2F32", "#D0D1D0"]
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

    const name = getUserDisplayName(user);


    const email =
        user
            ? (
                user.email ||
                ""
            )
            : "";


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

    updateGreeting();

}


function getUserDisplayName(user) {
    if (!user) return "Guest";
    return state.nickname || user.displayName || "User";
}


function normalizeNickname(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}


function isValidNickname(value) {
    return value.length > 0 && Array.from(value).length <= 40 && !/[\u0000-\u001F\u007F]/.test(value);
}


function updateNicknameInput() {
    const input = document.getElementById("nicknameInput");
    if (input) input.value = state.nickname;
}


async function loadNickname(user) {
    if (!user) return;
    try {
        const snapshot = await getDoc(doc(db, "users", user.uid, "profile", "settings"));
        const nickname = snapshot.exists() ? normalizeNickname(snapshot.data().nickname) : "";
        state.nickname = isValidNickname(nickname) ? nickname : "";
        updateUserProfile(user);
        updateNicknameInput();
    } catch (error) {
        console.error("Failed to load nickname:", error);
    }
}


function setupNicknameSetting() {
    const form = document.getElementById("nicknameForm");
    const input = document.getElementById("nicknameInput");
    if (!form || !input) return;
    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!state.currentUser || state.guestMode) return showToast("Sign in to save a nickname", true);
        const nickname = normalizeNickname(input.value);
        if (!isValidNickname(nickname)) return showToast("Use a nickname of 1–40 characters", true);
        const button = document.getElementById("saveNicknameButton");
        if (button) button.disabled = true;
        try {
            await setDoc(doc(db, "users", state.currentUser.uid, "profile", "settings"), { nickname: nickname, updatedAt: serverTimestamp() }, { merge: true });
            state.nickname = nickname;
            input.value = nickname;
            updateUserProfile(state.currentUser);
            showToast("Nickname saved");
        } catch (error) {
            console.error("Failed to save nickname:", error);
            showToast("Failed to save nickname", true);
        } finally {
            if (button) button.disabled = false;
        }
    });
}


function updateDashboardControlsVisibility() {
    const todayDate = document.getElementById("dashboardTodayDate");
    const homeGreeting = document.getElementById("homeGreeting");
    if (todayDate) todayDate.classList.toggle("hidden", state.currentPage !== "dashboard");
    if (homeGreeting) homeGreeting.classList.toggle("hidden", state.currentPage !== "dashboard");
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
        theme === "dark";


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


    if (!state.authResolved) {
        greetingElement.textContent = "Welcome";
        return;
    }

    const hour =
        new Date().getHours();


    const greeting = hour < 12
        ? "Good morning"
        : hour < 18
            ? "Good afternoon"
            : "Good evening";

    greetingElement.textContent =
        t(greeting) + ", " + getUserDisplayName(state.currentUser);

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

    messageElement.textContent = t(message);


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
    const resolvedStatus = !navigator.onLine ? "offline" : status;
    state.syncStatus = resolvedStatus;
    const element = document.getElementById("syncStatus");
    if (!element) return;
    element.hidden = resolvedStatus !== "offline" && resolvedStatus !== "failed";
    const labels = { saving: "Saving…", synced: "Synced", offline: "Offline", failed: "Sync failed" };
    element.textContent = t(labels[resolvedStatus] || labels.synced);
    element.className = "sync-status " + resolvedStatus;
}

function refreshSyncStatus() {
    if (!navigator.onLine) {
        setSyncStatus("offline");
        return;
    }
    if (state.syncFailed) {
        setSyncStatus("failed");
        return;
    }
    setSyncStatus(state.hasPendingWrites ? "saving" : "synced");
}

function waitForFirestoreCommit() {
    if (!state.currentUser || state.guestMode) return;
    const check = ++state.pendingWriteCheck;
    waitForPendingWrites(db).then(function () {
        if (check !== state.pendingWriteCheck) return;
        state.hasPendingWrites = false;
        state.syncFailed = false;
        refreshSyncStatus();
    }).catch(function (error) {
        if (check !== state.pendingWriteCheck) return;
        console.error("Pending Firestore writes were not confirmed:", error);
        state.syncFailed = true;
        refreshSyncStatus();
    });
}

function updatePendingWriteStatus(hasPendingWrites) {
    state.hasPendingWrites = Boolean(hasPendingWrites);
    if (state.hasPendingWrites) {
        state.syncFailed = false;
        waitForFirestoreCommit();
    }
    refreshSyncStatus();
}

function queueTransactionWrite(writePromise, failureMessage) {
    state.hasPendingWrites = true;
    state.syncFailed = false;
    refreshSyncStatus();
    Promise.resolve(writePromise).then(function () {
        waitForFirestoreCommit();
    }).catch(function (error) {
        console.error(failureMessage, error);
        state.syncFailed = true;
        state.hasPendingWrites = false;
        refreshSyncStatus();
        showToast(failureMessage, true);
    });
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
    undo.addEventListener("click", function () {
        const pending = state.pendingUndo; if (!pending || !state.currentUser) return;
        undo.disabled = true;
        try {
            const { id, ...data } = pending.transaction;
            const writePromise = setDoc(doc(db, "users", state.currentUser.uid, "transactions", id), data);
            queueTransactionWrite(writePromise, "Failed to restore transaction");
            clearTimeout(pending.timer); state.pendingUndo = null; toast.classList.remove("show"); showToast("Transaction restored");
        } catch (error) { console.error("Failed to restore transaction:", error); state.syncFailed = true; refreshSyncStatus(); showToast("Failed to restore transaction", true); undo.disabled = false; }
    });
    message.appendChild(undo); toast.classList.remove("error"); toast.classList.add("show");
    state.pendingUndo.timer = setTimeout(function () { if (state.pendingUndo?.transaction.id === transaction.id) { state.pendingUndo = null; toast.classList.remove("show"); } }, 5000);
}

function setupSyncStatus() {
    refreshSyncStatus();
    window.addEventListener("offline", refreshSyncStatus);
    window.addEventListener("online", function () { refreshSyncStatus(); if (state.hasPendingWrites) waitForFirestoreCommit(); });
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

function getAllTimeBalance() {
    return state.transactions.reduce(function (balance, item) {
        const amount = Number(item.amount || 0);
        if (!Number.isFinite(amount)) return balance;
        return item.type === "income" ? balance + amount : item.type === "expense" ? balance - amount : balance;
    }, 0);
}

function updateMonthUI() {
    const input = document.getElementById("selectedMonthInput");
    if (input) input.value = state.selectedMonth;
}

function updateTodayDateLabel() {
    const label = document.getElementById("dashboardTodayDate");
    if (!label) return;
    const today = new Date();
    label.dateTime = getDateKey(today);
    label.textContent = today.toLocaleDateString(getLocale(), { day: "numeric", month: "long", year: "numeric" });
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
    loadBudget();
    updateAll();
}

function setupMonthSelector() {
    document.getElementById("selectedMonthInput")?.addEventListener("change", function (event) { setSelectedMonth(event.target.value); });
    updateMonthUI();
}

function scheduleSelectedDateMidnightCheck() {
    const check = function () {
        const now = new Date();
        updateTodayDateLabel();
        if (state.followingToday) {
            const todayKey = getDateKey(now);
            if (state.selectedMonth !== getMonthKey(now) || state.selectedDate !== todayKey) {
                setSelectedMonth(getMonthKey(now));
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
    const groups = items.reduce(function (all, item) { const key = String(item.date || ""); (all[key] ||= []).push(item); return all; }, {});
    Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); }).forEach(function (date) {
        const group = document.createElement("section"); group.className = "transaction-date-group";
        const isToday = date === getDateKey(new Date());
        const displayDate = new Date(date + "T00:00:00").toLocaleDateString(getLocale(), { day: "numeric", month: "short", year: "numeric" });
        group.innerHTML = '<h2>' + (isToday ? t("Today") + " · " : "") + escapeHTML(displayDate) + '</h2>';
        groups[date].forEach(function (item) {
            const row = document.createElement("article"), amountClass = item.type === "income" ? "income" : "expense";
            row.className = "transaction-item compact-transaction " + amountClass;
            row.innerHTML = '<div class="transaction-info"><strong>' + escapeHTML(item.category || "Other") + '</strong><span>' + escapeHTML(item.note || item.type) + '</span></div><strong class="transaction-amount ' + amountClass + '">' + (item.type === "income" ? "+" : "−") + formatCurrency(item.amount) + '</strong><div class="transaction-row-actions"><button type="button" class="text-button" data-edit-transaction="' + escapeHTML(item.id) + '">Edit</button><button type="button" class="text-button transaction-delete" data-delete-transaction="' + escapeHTML(item.id) + '">Delete</button></div>';
            row.querySelector(".transaction-info span")?.remove();
            const editButton = row.querySelector("[data-edit-transaction]"), deleteButton = row.querySelector("[data-delete-transaction]");
            editButton.className = "transaction-icon-action"; deleteButton.className = "transaction-icon-action transaction-delete";
            editButton.setAttribute("aria-label", t("Edit transaction")); editButton.title = t("Edit transaction"); editButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4"/></svg>';
            deleteButton.setAttribute("aria-label", t("Delete transaction")); deleteButton.title = t("Delete transaction"); deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16 M10 11v6 M14 11v6 M9 7l1-2h4l1 2 M6 7l1 13h10l1-13"/></svg>';
            editButton.addEventListener("click", function (event) { event.stopPropagation(); openTransactionModal(item.type, item); });
            deleteButton.addEventListener("click", function (event) { event.stopPropagation(); deleteTransaction(item.id); });
            group.appendChild(row);
        });
        container.appendChild(group);
    });
}

function updateAnalytics() {
    // Dashboard is the single analysis surface; transaction data stays unchanged.
}

function renderSpendingBreakdownLegacy() {
    return;
    const expenses = getSelectedMonthTransactions().filter(function (item) { return item.type === "expense"; });
    const totals = expenses.reduce(function (all, item) { const key = item.category || "Other"; all[key] = (all[key] || 0) + Number(item.amount || 0); return all; }, {});
    const entries = Object.entries(totals).sort(function (a, b) { return b[1] - a[1]; }), total = entries.reduce(function (sum, item) { return sum + item[1]; }, 0);
    const empty = document.getElementById("spendingEmpty"), content = document.getElementById("spendingContent");
    if (empty) empty.classList.toggle("hidden", total > 0); if (content) content.classList.toggle("hidden", total <= 0);
    if (!total || typeof Chart === "undefined") { if (state.spendingChart) { state.spendingChart.destroy(); state.spendingChart = null; } return; }
    document.getElementById("chartTotal").textContent = formatCurrency(total);
    const colors = entries.map(function (entry) { return getCategoryColor(entry[0]); });
    const legend = document.getElementById("spendingLegend"); legend.innerHTML = entries.map(function (entry, index) { const percent = Math.round(entry[1] / total * 100); return '<div class="legend-item"><span class="legend-dot" style="background:' + colors[index % colors.length] + '"></span><span>' + escapeHTML(entry[0]) + '</span><strong>' + formatCurrency(entry[1]) + '<small> · ' + percent + '%</small></strong></div>'; }).join("");
    if (state.spendingChart) state.spendingChart.destroy();
    state.spendingChart = new Chart(document.getElementById("spendingChart"), { type: "doughnut", data: { labels: entries.map(function (entry) { return entry[0]; }), datasets: [{ data: entries.map(function (entry) { return entry[1]; }), backgroundColor: entries.map(function (_, index) { return colors[index % colors.length]; }), borderWidth: 0, borderRadius: 12, spacing: 2, hoverOffset: 6 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "74%", animation: { duration: 0 }, transitions: { active: { animation: { duration: 140 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return ctx.label + ": " + formatCurrency(ctx.raw); } } } } } });
}

function updateDashboard() {
    const balance = getAllTimeBalance();
    setMoney("balanceAmount", balance);
    const status = document.getElementById("balanceStatus"); if (status) status.textContent = balance > 0 ? "Healthy" : balance === 0 ? "Balanced" : "Over budget";
    updateBudgetUI(); renderSpendingBreakdown();
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
    document.getElementById("saveAppearanceButton")?.addEventListener("click", function () {
        const selected = document.querySelector("[data-theme].active")?.dataset.theme || "light";
        const primary = document.getElementById("primaryColor")?.value;
        const secondary = document.getElementById("secondaryColor")?.value;
        localStorage.setItem("expense_appearance", selected);
        if (primary && secondary) { localStorage.setItem("expense_primary_color", primary); localStorage.setItem("expense_secondary_color", secondary); localStorage.setItem("expense_has_custom_colors", "true"); }
        applyTheme(selected); applySavedAccentColors(); renderSpendingBreakdown(); showToast("Appearance saved");
    });
}

function applySavedAccentColors() {
    const primary = localStorage.getItem("expense_primary_color");
    const secondary = localStorage.getItem("expense_secondary_color");
    const primaryInput = document.getElementById("primaryColor"), secondaryInput = document.getElementById("secondaryColor");
    const hasCustomColors = localStorage.getItem("expense_has_custom_colors") === "true";
    if (hasCustomColors && primary && /^#[0-9a-f]{6}$/i.test(primary)) { document.documentElement.style.setProperty("--primary", primary); if (primaryInput) primaryInput.value = primary; }
    else document.documentElement.style.setProperty("--primary", "#242628");
    if (hasCustomColors && secondary && /^#[0-9a-f]{6}$/i.test(secondary)) { document.documentElement.style.setProperty("--secondary", secondary); if (secondaryInput) secondaryInput.value = secondary; }
    else document.documentElement.style.setProperty("--secondary", "#858889");
}

function migrateLegacyThemeColors() {
    const primary = localStorage.getItem("expense_primary_color"), secondary = localStorage.getItem("expense_secondary_color");
    const legacyPairs = [["#7c5cfc", "#5cc8ff"], ["#36383d", "#72757c"]];
    const normalized = [String(primary || "").toLowerCase(), String(secondary || "").toLowerCase()];
    if (legacyPairs.some(function (pair) { return pair[0] === normalized[0] && pair[1] === normalized[1]; })) {
        localStorage.setItem("expense_primary_color", "#242628");
        localStorage.setItem("expense_secondary_color", "#858889");
    }
}

function loadLocalSettings() {
    const currency = localStorage.getItem("expense_currency");
    if (currency) { state.currency = currency; const select = document.getElementById("currencySelect"); if (select) select.value = currency; }
    let appearance = localStorage.getItem("expense_appearance") || localStorage.getItem("expense_theme") || "light";
    if (appearance === "system") { appearance = "light"; localStorage.setItem("expense_appearance", appearance); }
    applyTheme(appearance);
    migrateLegacyThemeColors();
    applySavedAccentColors();
    document.querySelectorAll("[data-theme]").forEach(function (button) { button.classList.toggle("active", button.dataset.theme === appearance); });
}


function getCategoryColor(category) {
    const hash = Array.from(String(category)).reduce(function (value, char) { return ((value << 5) - value + char.charCodeAt(0)) | 0; }, 0);
    const index = Math.abs(hash) % 6;
    const savedPrimary = localStorage.getItem("expense_primary_color"), savedSecondary = localStorage.getItem("expense_secondary_color");
    if (!(localStorage.getItem("expense_has_custom_colors") === "true" && /^#[0-9a-f]{6}$/i.test(savedPrimary || "") && /^#[0-9a-f]{6}$/i.test(savedSecondary || ""))) {
        return (document.body.classList.contains("dark") ? ["#f1f1ef", "#d0d1d0", "#aeb0b0", "#858889", "#5f6264", "#3f4244"] : ["#242628", "#3f4244", "#5f6264", "#858889", "#aeb0b0", "#d0d1d0"])[index];
    }
    const styles = getComputedStyle(document.documentElement);
    const base = index % 2 ? styles.getPropertyValue("--secondary").trim() : styles.getPropertyValue("--primary").trim();
    const match = /^#([0-9a-f]{6})$/i.exec(base); if (!match) return base;
    const value = parseInt(match[1], 16), r = value >> 16, g = (value >> 8) & 255, b = value & 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), hue = ((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI) + 360) % 360;
    const saturation = max === min ? 0 : ((max - min) / (255 - Math.abs(max + min - 255))) * 100;
    const lightness = ((max + min) / 510) * 100 + (index - 2.5) * 8;
    return "hsl(" + Math.round(hue) + " " + Math.round(Math.min(85, Math.max(18, saturation))) + "% " + Math.round(Math.min(78, Math.max(24, lightness))) + "%)";
}

function renderSpendingLabels(entries, colors) {
    const labels = document.getElementById("spendingLabels"); if (!labels) return;
    labels.innerHTML = "";
    const left = [], right = [];
    entries.forEach(function (entry, index) { (index / entries.length < .5 ? right : left).push([entry, index]); });
    [left, right].forEach(function (side, sideIndex) { side.forEach(function (pair, position) {
        const entry = pair[0], index = pair[1], label = document.createElement("span");
        const y = ((position + 1) / (side.length + 1)) * 82 + 9;
        label.textContent = entry[0]; label.className = "spending-label";
        label.style.setProperty("--label-x", (sideIndex === 0 ? 90 : 10) + "%"); label.style.setProperty("--label-y", y + "%"); label.style.setProperty("--label-color", colors[index]); label.classList.toggle("label-left", sideIndex === 1);
        labels.appendChild(label);
    }); });
}

function getExternalLabelGeometry(centerX, centerY, outerRadius, canvasWidth, chartTop, chartBottom, side, position, count, textWidth) {
    const gap = 16, edge = centerX + side * outerRadius, elbowX = centerX + side * (outerRadius + 18);
    const labelY = chartTop + 16 + ((position + 1) / (count + 1)) * (chartBottom - chartTop - 32);
    const textX = side > 0 ? Math.max(edge + gap, Math.min(canvasWidth - textWidth - 6, elbowX + 8)) : Math.min(edge - gap, Math.max(textWidth + 6, elbowX - 8));
    return { edge, elbowX, labelY, textX, left: side > 0 ? textX : textX - textWidth, right: side > 0 ? textX + textWidth : textX };
}

function assertExternalLabelGeometry(geometry, centerX, outerRadius, side) {
    const boundary = centerX + side * outerRadius;
    return side > 0 ? geometry.left >= boundary + 16 : geometry.right <= boundary - 16;
}

const chartExternalLabels = {
    id: "chartExternalLabels",
    afterDatasetsDraw: function (chart, args, options) {
        const meta = chart.getDatasetMeta(0), labels = options.labels || [], ctx = chart.ctx;
        const sides = [[], []];
        meta.data.forEach(function (arc, index) {
            const angle = (arc.startAngle + arc.endAngle) / 2;
            (Math.cos(angle) >= 0 ? sides[1] : sides[0]).push({ arc, index, angle });
        });
        ctx.save(); ctx.font = "500 14px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"; ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text-secondary").trim(); ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--border").trim(); ctx.lineWidth = 1;
        sides.forEach(function (side, sideIndex) {
            side.sort(function (a, b) { return Math.sin(a.angle) - Math.sin(b.angle); });
            side.forEach(function (item, position) {
                const arc = item.arc, direction = sideIndex ? 1 : -1, text = t(labels[item.index] || ""), textWidth = ctx.measureText(text).width;
                const geometry = getExternalLabelGeometry(arc.x, arc.y, arc.outerRadius, chart.width, chart.chartArea.top, chart.chartArea.bottom, direction, position, side.length, textWidth);
                if (!assertExternalLabelGeometry(geometry, arc.x, arc.outerRadius, direction)) return;
                const startX = geometry.edge, startY = arc.y, lineEndX = direction > 0 ? geometry.textX - 5 : geometry.textX + 5;
                ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(geometry.elbowX, startY); ctx.lineTo(lineEndX, geometry.labelY); ctx.stroke();
                ctx.textAlign = direction > 0 ? "left" : "right"; ctx.textBaseline = "middle"; ctx.fillText(text, geometry.textX, geometry.labelY);
            });
        });
        ctx.restore();
    }
};

function renderSpendingBreakdown() {
    const expenses = getSelectedMonthTransactions().filter(function (item) { return item.type === "expense"; });
    const totals = expenses.reduce(function (all, item) { const key = item.category || "Other"; all[key] = (all[key] || 0) + Number(item.amount || 0); return all; }, {});
    const entries = Object.entries(totals).sort(function (a, b) { return b[1] - a[1]; }), total = entries.reduce(function (sum, item) { return sum + item[1]; }, 0);
    const empty = document.getElementById("spendingEmpty"), content = document.getElementById("spendingContent");
    if (empty) empty.classList.toggle("hidden", total > 0); if (content) content.classList.toggle("hidden", total <= 0);
    if (!total || typeof Chart === "undefined") { if (state.spendingChart) { state.spendingChart.destroy(); state.spendingChart = null; } return; }
    document.getElementById("chartTotal").textContent = formatCurrency(total);
    const colors = entries.map(function (entry) { return getCategoryColor(entry[0]); }); document.getElementById("spendingLabels").innerHTML = "";
    const measureCanvas = document.createElement("canvas"), measureContext = measureCanvas.getContext("2d");
    measureContext.font = "500 14px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    const labelPadding = Math.max(104, Math.ceil(Math.max.apply(null, entries.map(function (entry) { return measureContext.measureText(t(entry[0])).width; })) + 28));
    if (state.spendingChart) state.spendingChart.destroy();
    state.spendingChart = new Chart(document.getElementById("spendingChart"), { type: "doughnut", plugins: [chartExternalLabels], data: { labels: entries.map(function (entry) { return entry[0]; }), datasets: [{ data: entries.map(function (entry) { return entry[1]; }), backgroundColor: colors, borderWidth: 0, borderRadius: 10, spacing: 2, hoverOffset: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "84%", layout: { padding: { left: labelPadding, right: labelPadding, top: 18, bottom: 18 } }, animation: { duration: 260 }, events: [], plugins: { legend: { display: false }, tooltip: { enabled: false }, chartExternalLabels: { labels: entries.map(function (entry) { return entry[0]; }) } } } });
}

/* =========================================================
   CURRENCY CONVERTER
========================================================= */

const converterDefaults = [
    ["AUD", "Australian Dollar"], ["CAD", "Canadian Dollar"], ["CHF", "Swiss Franc"], ["CNY", "Chinese Yuan"],
    ["CZK", "Czech Koruna"], ["DKK", "Danish Krone"], ["EUR", "Euro"], ["GBP", "British Pound"],
    ["HKD", "Hong Kong Dollar"], ["HUF", "Hungarian Forint"], ["IDR", "Indonesian Rupiah"], ["INR", "Indian Rupee"],
    ["JPY", "Japanese Yen"], ["KRW", "South Korean Won"], ["MYR", "Malaysian Ringgit"], ["NOK", "Norwegian Krone"],
    ["NZD", "New Zealand Dollar"], ["PHP", "Philippine Peso"], ["PLN", "Polish Zloty"], ["SEK", "Swedish Krona"],
    ["SGD", "Singapore Dollar"], ["THB", "Thai Baht"], ["TRY", "Turkish Lira"], ["USD", "US Dollar"], ["ZAR", "South African Rand"]
];

const converterCurrencyDetails = {
    AUD: ["🇦🇺", "A$"], CAD: ["🇨🇦", "CA$"], CHF: ["🇨🇭", "CHF"], CNY: ["🇨🇳", "¥"],
    CZK: ["🇨🇿", "Kč"], DKK: ["🇩🇰", "kr"], EUR: ["🇪🇺", "€"], GBP: ["🇬🇧", "£"],
    HKD: ["🇭🇰", "HK$"], HUF: ["🇭🇺", "Ft"], IDR: ["🇮🇩", "Rp"], INR: ["🇮🇳", "₹"],
    JPY: ["🇯🇵", "¥"], KRW: ["🇰🇷", "₩"], MYR: ["🇲🇾", "RM"], NOK: ["🇳🇴", "kr"],
    NZD: ["🇳🇿", "NZ$"], PHP: ["🇵🇭", "₱"], PLN: ["🇵🇱", "zł"], SEK: ["🇸🇪", "kr"],
    SGD: ["🇸🇬", "S$"], THB: ["🇹🇭", "฿"], TRY: ["🇹🇷", "₺"], USD: ["🇺🇸", "US$"], ZAR: ["🇿🇦", "R"]
};

const CONVERTER_RATE_CACHE_KEY = "expense_converter_rates_v1";
const CONVERTER_CURRENCY_CACHE_KEY = "expense_converter_currencies_v1";
let converterRequestId = 0;
let converterDebounceTimer = null;
let converterCurrencyEntries = converterDefaults.map(function (entry) { return { code: entry[0], name: entry[1] }; });
let activeCurrencyPickerTarget = null;


function getConverterCache(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch (_) { return fallback; }
}


function setConverterCache(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn("Unable to cache converter data:", error); }
}


function normalizeCurrencyCode(value) {
    return String(value || "").trim().toUpperCase();
}


function getConverterCurrencyDetails(code, name) {
    const normalized = normalizeCurrencyCode(code);
    const details = converterCurrencyDetails[normalized] || ["🌐", normalized];
    return { code: normalized, name: name || normalized, flag: details[0], symbol: details[1] };
}


function updateConverterCurrencyCards() {
    ["from", "to"].forEach(function (target) {
        const code = normalizeCurrencyCode(document.getElementById("converter" + target[0].toUpperCase() + target.slice(1))?.value);
        const entry = converterCurrencyEntries.find(function (item) { return item.code === code; });
        const details = getConverterCurrencyDetails(code, entry?.name);
        const prefix = "converter" + target[0].toUpperCase() + target.slice(1);
        const flag = document.getElementById(prefix + "Flag"), codeLabel = document.getElementById(prefix + "Code"), nameLabel = document.getElementById(prefix + "Name"), symbol = document.getElementById(prefix + "Symbol");
        if (flag) flag.textContent = details.flag;
        if (codeLabel) codeLabel.textContent = details.code;
        if (nameLabel) nameLabel.textContent = details.name;
        if (symbol) symbol.textContent = details.symbol;
    });
}


function renderCurrencyPickerList(query) {
    const list = document.getElementById("currencyPickerList");
    if (!list) return;
    const needle = String(query || "").trim().toLowerCase();
    const entries = converterCurrencyEntries.filter(function (entry) { return !needle || entry.code.toLowerCase().includes(needle) || entry.name.toLowerCase().includes(needle); });
    list.innerHTML = entries.length ? entries.map(function (entry) {
        const details = getConverterCurrencyDetails(entry.code, entry.name);
        return '<button class="currency-picker-option" type="button" role="option" data-currency-code="' + details.code + '"><span class="currency-flag" aria-hidden="true">' + details.flag + '</span><span class="currency-picker-copy"><strong>' + details.code + '</strong><small>' + escapeHTML(details.name) + '</small></span><span class="currency-symbol">' + escapeHTML(details.symbol) + '</span></button>';
    }).join("") : '<p class="currency-picker-empty">No currencies found.</p>';
}


function closeCurrencyPicker() {
    document.getElementById("currencyPicker")?.classList.add("hidden");
    activeCurrencyPickerTarget = null;
}


function openCurrencyPicker(target) {
    activeCurrencyPickerTarget = target;
    const picker = document.getElementById("currencyPicker"), search = document.getElementById("currencyPickerSearch");
    if (!picker || !search) return;
    search.value = "";
    renderCurrencyPickerList();
    picker.classList.remove("hidden");
    requestAnimationFrame(function () { search.focus(); });
}


function selectConverterCurrency(code) {
    if (!activeCurrencyPickerTarget) return;
    const input = document.getElementById("converter" + activeCurrencyPickerTarget[0].toUpperCase() + activeCurrencyPickerTarget.slice(1));
    if (!input) return;
    input.value = normalizeCurrencyCode(code);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    updateConverterCurrencyCards();
    closeCurrencyPicker();
}


function renderConverterCurrencies(items) {
    const unique = new Map(converterDefaults);
    (items || []).forEach(function (item) {
        const code = normalizeCurrencyCode(item.iso_code || item.code || item.currency || item[0]);
        const name = item.name || item[1] || "";
        if (/^[A-Z]{3}$/.test(code)) unique.set(code, name || unique.get(code) || code);
    });
    converterCurrencyEntries = Array.from(unique.entries()).sort(function (a, b) { return a[0].localeCompare(b[0]); })
        .map(function (entry) { return { code: entry[0], name: entry[1] }; });
    updateConverterCurrencyCards();
    renderCurrencyPickerList(document.getElementById("currencyPickerSearch")?.value);
}


function updateConverterStatus(message, kind) {
    const status = document.getElementById("converterStatus");
    if (!status) return;
    status.textContent = message;
    status.className = "converter-status" + (kind ? " " + kind : "");
}


function renderConverterRate(rateData, cached) {
    const amount = Number(document.getElementById("converterAmount")?.value || 0);
    const from = normalizeCurrencyCode(document.getElementById("converterFrom")?.value);
    const to = normalizeCurrencyCode(document.getElementById("converterTo")?.value);
    const result = document.getElementById("converterResult");
    const rate = document.getElementById("converterRate");
    const updated = document.getElementById("converterUpdated");
    updateConverterCurrencyCards();
    if (!result || !rate || !updated) return;
    if (!rateData || !Number.isFinite(Number(rateData.rate))) {
        result.textContent = "—";
        rate.textContent = "Reference rate: unavailable";
        updated.textContent = "Last updated: —";
        return;
    }
    const converted = Number.isFinite(amount) ? amount * Number(rateData.rate) : 0;
    result.textContent = new Intl.NumberFormat(undefined, { style: "currency", currency: to, maximumFractionDigits: 2 }).format(converted);
    rate.textContent = "Reference rate: 1 " + from + " = " + Number(rateData.rate).toLocaleString(undefined, { maximumFractionDigits: 6 }) + " " + to;
    updated.textContent = "Last updated: " + (rateData.date || "—") + (cached ? " · cached" : "");
}


async function loadConverterCurrencies() {
    const cached = getConverterCache(CONVERTER_CURRENCY_CACHE_KEY, []);
    renderConverterCurrencies(cached);
    if (!navigator.onLine) return;
    try {
        const response = await fetch("https://api.frankfurter.dev/v2/currencies");
        if (!response.ok) throw new Error("Currency list request failed");
        const data = await response.json();
        const items = Array.isArray(data) ? data : Object.entries(data || {}).map(function ([code, name]) { return { code: code, name: name }; });
        setConverterCache(CONVERTER_CURRENCY_CACHE_KEY, items);
        renderConverterCurrencies(items);
    } catch (error) {
        console.warn("Using cached converter currencies:", error);
    }
}


async function convertCurrency() {
    const fromInput = document.getElementById("converterFrom");
    const toInput = document.getElementById("converterTo");
    if (!fromInput || !toInput) return;
    const from = normalizeCurrencyCode(fromInput.value);
    const to = normalizeCurrencyCode(toInput.value);
    fromInput.value = from;
    toInput.value = to;
    const key = from + ":" + to;
    const cache = getConverterCache(CONVERTER_RATE_CACHE_KEY, {});
    const cached = cache[key];
    const requestId = ++converterRequestId;
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
        renderConverterRate(null, false);
        updateConverterStatus("Enter 3-letter codes", "error");
        return;
    }
    if (from === to) {
        const sameCurrency = { rate: 1, date: new Date().toISOString().slice(0, 10) };
        renderConverterRate(sameCurrency, false);
        updateConverterStatus("Same currency");
        return;
    }
    if (cached) renderConverterRate(cached, true);
    if (!navigator.onLine) {
        updateConverterStatus(cached ? "Cached rate · offline" : "Offline · no cached rate", cached ? "cached" : "error");
        return;
    }
    updateConverterStatus(cached ? "Refreshing rate…" : "Loading rate…");
    try {
        const response = await fetch("https://api.frankfurter.dev/v2/rate/" + encodeURIComponent(from) + "/" + encodeURIComponent(to));
        if (!response.ok) throw new Error("Rate request failed");
        const data = await response.json();
        const fresh = { rate: Number(data.rate), date: data.date || "" };
        if (!Number.isFinite(fresh.rate)) throw new Error("Invalid rate response");
        cache[key] = fresh;
        setConverterCache(CONVERTER_RATE_CACHE_KEY, cache);
        if (requestId !== converterRequestId) return;
        renderConverterRate(fresh, false);
        updateConverterStatus("Latest reference rate");
    } catch (error) {
        if (requestId !== converterRequestId) return;
        renderConverterRate(cached || null, Boolean(cached));
        updateConverterStatus(cached ? "Cached rate · update unavailable" : "Rate unavailable", cached ? "cached" : "error");
    }
}


function scheduleCurrencyConversion() {
    clearTimeout(converterDebounceTimer);
    converterDebounceTimer = setTimeout(convertCurrency, 180);
}


function setupCurrencyConverter() {
    const amount = document.getElementById("converterAmount");
    const from = document.getElementById("converterFrom");
    const to = document.getElementById("converterTo");
    const swap = document.getElementById("swapCurrenciesButton");
    const search = document.getElementById("currencyPickerSearch"), picker = document.getElementById("currencyPicker");
    if (!amount || !from || !to || !swap) return;
    [amount, from, to].forEach(function (input) { input.addEventListener("input", scheduleCurrencyConversion); input.addEventListener("change", scheduleCurrencyConversion); });
    document.querySelectorAll("[data-currency-target]").forEach(function (button) { button.addEventListener("click", function () { openCurrencyPicker(button.dataset.currencyTarget); }); });
    document.getElementById("closeCurrencyPicker")?.addEventListener("click", closeCurrencyPicker);
    picker?.addEventListener("click", function (event) { if (event.target === picker) closeCurrencyPicker(); });
    document.getElementById("currencyPickerList")?.addEventListener("click", function (event) { const option = event.target.closest("[data-currency-code]"); if (option) selectConverterCurrency(option.dataset.currencyCode); });
    search?.addEventListener("input", function () { renderCurrencyPickerList(search.value); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeCurrencyPicker(); });
    swap.addEventListener("click", function () { const previous = from.value; from.value = to.value; to.value = previous; updateConverterCurrencyCards(); convertCurrency(); });
    window.addEventListener("online", function () { loadConverterCurrencies(); convertCurrency(); });
    updateConverterCurrencyCards();
    loadConverterCurrencies();
    convertCurrency();
}

document.addEventListener("DOMContentLoaded", function () { document.getElementById("dateFilter").value = "selected"; setupSyncStatus(); setupMonthSelector(); updateTodayDateLabel(); scheduleSelectedDateMidnightCheck(); setupBudget(); setupGuestImport(); setupAppearancePersistence(); setupCurrencyConverter(); updateDashboardControlsVisibility(); updateAll(); });
onAuthStateChanged(auth, function (user) {
    if (!user) { if (state.unsubscribeBudget) { state.unsubscribeBudget(); state.unsubscribeBudget = null; } state.currentBudget = null; updateBudgetUI(); return; }
    loadBudget(); const guestItems = loadGuestTransactions();
    if (guestItems.length) { document.getElementById("guestImportMessage").textContent = "You have " + guestItems.length + " transaction" + (guestItems.length === 1 ? "" : "s") + " saved on this device. Would you like to add them to your account?"; document.getElementById("guestImportModal")?.classList.remove("hidden"); }
});

/* Active budget implementation: category budgets only. Existing document.amount is untouched. */
function setupBudget() {
    const source = document.querySelector("#dashboardPage .budget-card");
    const target = document.getElementById("budgetPageContent");
    if (source && target) target.appendChild(source);
    const card = target?.querySelector(".budget-card");
    if (card) card.innerHTML = '<div class="budget-heading"><div><span class="eyebrow">PLAN</span><h3 id="budgetTitle">Category Budgets</h3></div></div><div id="budgetEmpty" class="budget-empty"><strong>No category budgets set</strong><span>Add a category budget to track your spending.</span></div><div id="categoryBudgetSection" class="category-budget-section hidden"><div class="category-budget-title"><span class="eyebrow">CATEGORY BUDGETS</span><span id="categoryBudgetHint"></span></div><div id="categoryBudgetList" class="category-budget-list"></div></div><button id="addCategoryBudgetButton" class="secondary-button budget-add-category" type="button">+ Add Category Budget</button>';
    const modal = document.getElementById("budgetModal");
    if (!modal) return;
    modal.innerHTML = '<div class="modal-card budget-modal-card"><div class="modal-header"><div><span class="eyebrow">CATEGORY BUDGET</span><h2 id="budgetModalTitle">Add Category Budget</h2><p id="budgetMonthName"></p></div><button id="closeBudgetModal" class="icon-button" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><form id="budgetForm"><div class="form-group"><label for="budgetAmountInput">Amount</label><div class="amount-input"><span id="budgetCurrencyPrefix">RM</span><input id="budgetAmountInput" type="number" min="0.01" step="0.01" required></div></div><div class="form-group"><label for="budgetCategorySelect">Category</label><select id="budgetCategorySelect" class="form-input"><option value="">Select category</option></select></div><div class="modal-actions"><button id="cancelBudgetButton" class="secondary-button" type="button">Cancel</button><button class="primary-button" type="submit">Save</button></div></form></div>';
    let editingCategory = null;
    const close = function () { modal.classList.add("hidden"); };
    const open = function (category = null) {
        editingCategory = category;
        const select = document.getElementById("budgetCategorySelect");
        document.getElementById("budgetModalTitle").textContent = category ? "Edit Category Budget" : "Add Category Budget";
        document.getElementById("budgetMonthName").textContent = monthLabel();
        document.getElementById("budgetCurrencyPrefix").textContent = (formatCurrency(0).match(/^\S+/) || [state.currency])[0];
        select.innerHTML = '<option value="">Select category</option>' + getBudgetCategories().map(function (name) { return '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>'; }).join("");
        select.value = category || "";
        select.disabled = Boolean(category);
        document.getElementById("budgetAmountInput").value = category ? getCurrentCategoryBudgets()[category] || "" : "";
        modal.classList.remove("hidden"); document.getElementById("budgetAmountInput").focus();
    };
    document.getElementById("addCategoryBudgetButton")?.addEventListener("click", function () { if (!state.currentUser || state.guestMode) return showToast("Sign in to manage budgets", true); open(); });
    document.getElementById("closeBudgetModal").addEventListener("click", close);
    document.getElementById("cancelBudgetButton").addEventListener("click", close);
    document.getElementById("budgetForm").addEventListener("submit", async function (event) {
        event.preventDefault();
        const amount = Number(document.getElementById("budgetAmountInput").value);
        const category = editingCategory || document.getElementById("budgetCategorySelect").value;
        if (!isPositiveAmount(amount)) return showToast("Please enter a valid budget amount.", true);
        if (!category || !getBudgetCategories().includes(category)) return showToast("Please select a category.", true);
        if (!state.currentUser || state.guestMode) return showToast("Sign in to manage budgets", true);
        const [year, month] = state.selectedMonth.split("-").map(Number);
        const ref = doc(db, "users", state.currentUser.uid, "budgets", state.selectedMonth);
        const payload = { ["categories." + category]: amount, year, month, updatedAt: serverTimestamp() };
        try { if (state.currentBudget) await updateDoc(ref, payload); else await setDoc(ref, { categories: { [category]: amount }, year, month, updatedAt: serverTimestamp() }); close(); showToast("Category budget saved"); }
        catch (error) { console.error("Failed to save category budget:", error); showToast("Failed to save category budget", true); }
    });
    target?.addEventListener("click", async function (event) {
        const edit = event.target.closest("[data-edit-budget]"); const remove = event.target.closest("[data-delete-budget]");
        if (edit) open(edit.dataset.editBudget);
        if (remove && state.currentUser && !state.guestMode) {
            const ref = doc(db, "users", state.currentUser.uid, "budgets", state.selectedMonth);
            try { await updateDoc(ref, { ["categories." + remove.dataset.deleteBudget]: deleteField(), updatedAt: serverTimestamp() }); showToast("Category budget deleted"); }
            catch (error) { console.error("Failed to delete category budget:", error); showToast("Failed to delete category budget", true); }
        }
    });
}

function updateBudgetUI() {
    const card = document.querySelector("#budgetPageContent .budget-card"), pageMonth = document.getElementById("budgetPageMonth");
    if (pageMonth) pageMonth.textContent = monthLabel();
    if (!card) return;
    const empty = card.querySelector("#budgetEmpty"), section = card.querySelector("#categoryBudgetSection"), list = card.querySelector("#categoryBudgetList");
    if (state.guestMode || !state.currentUser) { empty.classList.remove("hidden"); empty.innerHTML = '<strong>Sign in to manage category budgets</strong><span>Budgets sync securely across your devices.</span>'; section.classList.add("hidden"); return; }
    const spending = getCategorySpending();
    const entries = Object.entries(getCurrentCategoryBudgets()).map(function ([category, budget]) { const spent = Number(spending[category] || 0); return { category, budget, spent, percent: Math.round(spent / budget * 100), over: spent > budget }; }).sort(function (a, b) { return Number(b.over) - Number(a.over) || b.percent - a.percent || a.category.localeCompare(b.category); });
    empty.classList.toggle("hidden", entries.length > 0); section.classList.toggle("hidden", entries.length === 0);
    if (!entries.length) { list.innerHTML = ""; return; }
    section.querySelector("#categoryBudgetHint").textContent = monthLabel();
    list.innerHTML = entries.map(function (item) { const status = item.over ? formatCurrency(item.spent - item.budget) + " over budget" : formatCurrency(item.budget - item.spent) + " remaining"; return '<div class="category-budget-row' + (item.over ? ' over' : '') + '"><div class="category-budget-row-top"><strong>' + escapeHTML(item.category) + '</strong><span>' + formatCurrency(item.spent) + ' / ' + formatCurrency(item.budget) + '</span></div><div class="category-progress"><span style="width:' + Math.min(item.percent, 100) + '%"></span></div><div class="category-budget-status">' + item.percent + '% used · ' + status + '</div><div class="budget-row-actions"><button type="button" class="text-button" data-edit-budget="' + escapeHTML(item.category) + '">Edit</button><button type="button" class="text-button budget-delete" data-delete-budget="' + escapeHTML(item.category) + '">Delete</button></div></div>'; }).join("");
}

/* Legacy budget implementation retained for reference only. */
function setupBudgetLegacy2() {
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

const translations = {
    zh: {
        "Dashboard":"儀表板", "Transactions":"交易", "Budget":"預算", "Settings":"設定", "Converter":"匯率換算", "Home":"首頁", "Search":"搜尋", "Hide filters":"隱藏篩選", "Search transactions":"搜尋交易", "All types":"所有類型", "All categories":"所有分類", "Selected month":"所選月份", "All time":"所有時間", "Today":"今天", "Last 7 days":"最近 7 天", "This month":"本月", "Expense":"支出", "Income":"收入", "Add Expense":"新增支出", "Add Income":"新增收入", "Edit transaction":"編輯交易", "Save Changes":"儲存變更", "Saving…":"儲存中…", "Amount":"金額", "Category":"分類", "Date":"日期", "Note":"備註", "Select category":"選擇分類", "Add a note…":"新增備註…", "Edit":"編輯", "Delete":"刪除", "Cancel":"取消", "Close":"關閉", "No transactions":"沒有交易", "No transactions found":"找不到交易", "No expenses this month":"本月沒有支出", "Expense Breakdown":"支出分類", "Expenses":"支出", "Total Balance":"總餘額", "Available balance":"可用餘額", "Healthy":"健康", "Balanced":"平衡", "Over budget":"超出預算", "Category Budgets":"分類預算", "No category budgets set":"尚未設定分類預算", "Add a category budget to track your spending.":"新增分類預算以追蹤支出。", "Add Category Budget":"新增分類預算", "Edit Category Budget":"編輯分類預算", "Category budget saved":"分類預算已儲存", "Category budget deleted":"分類預算已刪除", "remaining":"剩餘", "over budget":"超出預算", "used":"已使用", "Language":"語言", "Choose the app language":"選擇應用程式語言", "Currency":"貨幣", "Theme":"主題", "Light":"淺色", "Dark":"深色", "Tools":"工具", "Preferences":"偏好設定", "Account":"帳戶", "Currency Converter":"匯率換算", "Exchange estimate":"匯率估算", "From":"從", "To":"至", "Converted amount":"換算金額", "Choose currency":"選擇貨幣", "Search currency":"搜尋貨幣", "Offline":"離線", "Sync failed":"同步失敗", "Food":"餐飲", "Transport":"交通", "Car Maintenance":"汽車保養", "Shopping":"購物", "Bills":"帳單", "Entertainment":"娛樂", "Education":"教育", "Health":"健康", "Other":"其他", "Salary":"薪資", "Allowance":"津貼", "Bonus":"獎金", "Gift":"禮物", "Business":"商業"
    }
};

Object.assign(translations.zh, {
    "Welcome":"歡迎", "Good morning":"早安", "Good afternoon":"午安", "Good evening":"晚安", "Guest":"訪客", "Sign in":"登入", "Log out":"登出", "Continue with Google":"使用 Google 繼續", "Continue as Guest":"以訪客身分繼續", "Transaction":"交易", "Add transaction":"新增交易", "Save transaction":"儲存交易", "Please enter a valid amount":"請輸入有效金額", "Please select a category":"請選擇分類", "Please select a date":"請選擇日期", "Please login first":"請先登入", "Transaction added":"交易已新增", "Transaction updated":"交易已更新", "Failed to save transaction":"儲存交易失敗", "Failed to update transaction":"更新交易失敗", "Transaction deleted":"交易已刪除", "Transaction restored":"交易已還原", "Undo":"復原", "Saving…":"儲存中…", "Synced":"已同步", "Offline":"離線", "Sync failed":"同步失敗", "Saving":"儲存中", "No transactions for this filter":"此篩選條件沒有交易", "No transactions for":"沒有符合以下條件的交易：", "No expenses this month":"本月沒有支出", "Add an expense to see your category breakdown.":"新增支出後即可查看分類圖表。", "This month":"本月", "Expense Breakdown":"支出分類", "Category Budgets":"分類預算", "Sign in to manage category budgets":"登入以管理分類預算", "Budgets sync securely across your devices.":"預算會安全同步到你的裝置。", "Please enter a valid budget amount.":"請輸入有效的預算金額。", "Please select a category.":"請選擇分類。", "Failed to save category budget":"儲存分類預算失敗", "Failed to delete category budget":"刪除分類預算失敗", "Currency Converter":"匯率換算", "Reference rate":"參考匯率", "Last updated":"最後更新", "Ready":"準備完成", "Converted amount":"換算金額", "Exchange estimate":"匯率估算", "Choose currency":"選擇貨幣", "Search currency":"搜尋貨幣", "Swap currencies":"交換貨幣", "Reference rates only. Your bank, card provider, or transfer service may use a different rate.":"僅供參考；銀行、發卡機構或匯款服務的匯率可能不同。", "Nickname":"暱稱", "Shown in your Dashboard greeting":"顯示在儀表板問候語中", "Save":"儲存", "Appearance":"外觀", "Accent colors":"主題色彩", "Personalize the dashboard gradient":"自訂儀表板色彩", "Generate colors":"產生色彩", "Choose how the app looks":"選擇應用程式外觀", "Used for all transaction totals":"用於所有交易總計", "Select category":"選擇分類", "Add a note…":"新增備註…", "Search transactions":"搜尋交易", "Filter by type":"依類型篩選", "Filter by category":"依分類篩選", "Filter by date":"依日期篩選", "Show or hide balance":"顯示或隱藏餘額", "Close":"關閉", "Delete transaction":"刪除交易", "Edit transaction":"編輯交易", "Add Category Budget":"新增分類預算", "Edit Category Budget":"編輯分類預算", "No category budgets set":"尚未設定分類預算", "Add a category budget to track your spending.":"新增分類預算以追蹤支出。"
});

function getLanguage() { return localStorage.getItem("expense_language") === "zh" ? "zh" : "en"; }
function getLocale() { return getLanguage() === "zh" ? "zh-Hans-MY" : "en-GB"; }
function t(value) { return translations.zh[value] && getLanguage() === "zh" ? translations.zh[value] : value; }

function applyLanguage(language) {
    localStorage.setItem("expense_language", language === "zh" ? "zh" : "en");
    const select = document.getElementById("languageSelect"); if (select) select.value = getLanguage();
    updateAll(); updateTodayDateLabel();
    const modalTitle = document.querySelector("#transactionModal:not(.hidden) h2"); if (modalTitle) modalTitle.textContent = getTransactionModalTitle();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) { const raw = node.__sourceText || node.nodeValue; node.__sourceText = raw; const trimmed = raw.trim(), translated = t(trimmed); node.nodeValue = raw.replace(trimmed, translated); });
    document.querySelectorAll("[placeholder],[aria-label]").forEach(function (element) { ["placeholder", "aria-label"].forEach(function (attribute) { const key = "i18n" + attribute, value = element.dataset[key] || element.getAttribute(attribute); if (value) { element.dataset[key] = value; element.setAttribute(attribute, t(value)); } }); });
}

function updateBudgetUILegacy2() {
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
